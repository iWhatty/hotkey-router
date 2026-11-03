// Canonical source: static-web-watt3d/tools/safe-chromium.mjs.
// Managed copies in app scripts must stay byte-identical. Node-only tooling.
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import path from 'node:path';
// Sibling managed copy: every repo that carries this helper carries both files.
import {
    acquireQuietWindow, enterHeavyWork, quietTokenFromEnv, readQuietWindow, waitOptionsFromEnv, waitUntilClear,
} from './quiet-window.mjs';

export function chromiumTime(now = Date.now()) {
    return String((BigInt(now) + 11644473600000n) * 1000n);
}

async function readJson(file) {
    try {
        const value = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
        return value;
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error; // Never launch after a corrupt or unreadable profile seed.
    }
}

export async function seedChromiumProfile(userDataDir, now = Date.now()) {
    const root = path.resolve(userDataDir);
    const localFile = path.join(root, 'Local State');
    const preferencesFile = path.join(root, 'Default', 'Preferences');
    await fs.mkdir(path.dirname(preferencesFile), { recursive: true });
    const local = await readJson(localFile);
    const preferences = await readJson(preferencesFile);
    local.password_manager = {
        ...local.password_manager,
        os_password_blank: false,
        os_password_last_changed: chromiumTime(now),
    };
    preferences.credentials_enable_service = false;
    preferences.credentials_enable_autosignin = false;
    await fs.writeFile(localFile, JSON.stringify(local), 'utf8');
    await fs.writeFile(preferencesFile, JSON.stringify(preferences), 'utf8');
    return root;
}

// Ordinary browser runs may overlap; each still gets a seeded profile and only
// one run may use a given supplied profile at a time. Performance-sensitive
// (CPU/GPU timing) runs opt in with { exclusive: true } or
// WATT3D_CHROMIUM_EXCLUSIVE=1 and then hold the account-scoped lock alone.
// Ordinary runs register as shared holders, so the two modes refuse each other
// before launch, across repositories and agents. Both also respect the
// machine-wide quiet window (quiet-window.mjs, docs/quiet-window.md).
const account = createHash('sha256').update(userInfo().username).digest('hex').slice(0, 16);
export const chromiumLockDir = path.join(tmpdir(), 'watt3d-chromium-' + account + '.lock');
export const chromiumSharedDir = path.join(tmpdir(), 'watt3d-chromium-' + account + '.shared');

export function chromiumExclusiveRequested(safety = {}, env = process.env) {
    if (safety.exclusive !== undefined && typeof safety.exclusive !== 'boolean') {
        throw new TypeError('safety.exclusive must be a boolean');
    }
    return safety.exclusive === true || env.WATT3D_CHROMIUM_EXCLUSIVE === '1';
}

function processExited(pid) {
    try { process.kill(pid, 0); return false; } catch (probe) { return probe.code === 'ESRCH'; }
}

function ownedByThisProcess(owner) {
    return Boolean(owner.token) && (owner.pid === process.pid
        || (owner.pid === null && owner.runnerPid === process.pid));
}

async function acquireDirLock(lockDir, busy) {
    const token = randomUUID();
    const ownerFile = path.join(lockDir, 'owner.json');
    try {
        await fs.mkdir(lockDir);
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // Recover only a validated lock belonging to an exited process.
        const owner = await readJson(ownerFile);
        if (!Number.isInteger(owner.pid) || !owner.token) throw new Error('Chromium lock needs manual inspection: ' + lockDir);
        if (!processExited(owner.pid)) throw new Error(busy(owner.pid));
        await fs.unlink(ownerFile);
        await fs.rmdir(lockDir);
        await fs.mkdir(lockDir); // Races fail closed.
    }
    try {
        await fs.writeFile(ownerFile, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
    } catch (error) {
        await fs.rmdir(lockDir).catch(() => {});
        throw error;
    }
    let released = false;
    return async () => {
        if (released) return;
        const owner = await readJson(ownerFile);
        if (owner.token !== token) throw new Error('Chromium lock owner changed');
        await fs.unlink(ownerFile);
        await fs.rmdir(lockDir);
        released = true;
    };
}

// Live shared registrations block an exclusive run. Entries of exited
// processes are removed; unreadable or crash-retained (pid null) entries fail
// closed for manual inspection.
async function liveSharedRuns() {
    let names;
    try { names = await fs.readdir(chromiumSharedDir); } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const live = [];
    for (const name of names.filter(name => name.endsWith('.json'))) {
        const file = path.join(chromiumSharedDir, name);
        let owner;
        try { owner = await readJson(file); } catch { live.push(file); continue; }
        if (Object.keys(owner).length === 0) continue; // Released while listing.
        if (Number.isInteger(owner.pid) && owner.token && processExited(owner.pid)) {
            await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            continue;
        }
        live.push(file);
    }
    return live;
}

async function acquireExclusiveLock() {
    const unlock = await acquireDirLock(chromiumLockDir,
        pid => 'Another performance-sensitive Chromium run is active (PID ' + pid + '). Run perf work serially.');
    let live;
    try { live = await liveSharedRuns(); } catch (error) { await unlock(); throw error; }
    if (live.length) {
        await unlock();
        throw new Error('Exclusive Chromium run refused: ' + live.length
            + ' ordinary browser run(s) active. Retry when they finish: ' + chromiumSharedDir);
    }
    return unlock;
}

async function registerSharedRun() {
    const token = randomUUID();
    const file = path.join(chromiumSharedDir, token + '.json');
    await fs.mkdir(chromiumSharedDir, { recursive: true });
    await fs.writeFile(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx' });
    let released = false;
    const release = async () => {
        if (released) return;
        await fs.unlink(file);
        released = true;
    };
    // Register first, then look: a concurrent exclusive run sees this entry or
    // this run sees its lock. Only an exited lock owner is ignored here; the
    // next exclusive acquirer recovers it.
    let owner;
    try {
        owner = await readJson(path.join(chromiumLockDir, 'owner.json'));
    } catch (error) {
        await release();
        throw new Error('Chromium lock needs manual inspection: ' + chromiumLockDir, { cause: error });
    }
    const holder = await describeAccountLockHolder(owner);
    if (holder) {
        await release();
        const error = new Error(holder.message);
        error.code = 'EACCOUNTLOCK';
        error.ownProcess = holder.ownProcess;
        throw error;
    }
    return release;
}

// null when the account lock is free (or owned by an exited process, which the
// next exclusive acquirer recovers). The lock is taken by exclusive perf runs
// here, and by every run of an older strict-lock helper copy or adapter.
async function describeAccountLockHolder(owner) {
    const stat = await fs.stat(chromiumLockDir).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!stat && Object.keys(owner).length === 0) return null;
    if (Number.isInteger(owner.pid) && owner.token && processExited(owner.pid)) return null;
    const age = stat ? ', held ' + Math.round((Date.now() - stat.mtimeMs) / 60_000) + ' min' : '';
    let who;
    if (Number.isInteger(owner.pid)) who = 'pid ' + owner.pid;
    else if (Number.isInteger(owner.runnerPid)) {
        who = 'adapter runner pid ' + owner.runnerPid + (processExited(owner.runnerPid)
            ? ' (exited; crash-retained - remove the lock by hand once no Chrome from it remains)' : '');
    } else who = 'unknown owner';
    return {
        ownProcess: owner.pid === process.pid || owner.runnerPid === process.pid,
        message: 'Chromium account lock ' + chromiumLockDir + ' is held by ' + who + age
            + ' (an exclusive perf run, or a run using an older strict-lock helper or adapter)',
    };
}

function quietWait(safety) {
    const wait = {};
    if (safety.noWait !== undefined) wait.noWait = safety.noWait === true;
    if (safety.waitMinutes !== undefined) wait.maxWaitMs = Number(safety.waitMinutes) * 60_000;
    return wait;
}

// Exclusive runs need the machine-wide quiet window (docs/quiet-window.md).
// Inside `quiet-window run` the inherited token already holds it; otherwise
// this process acquires one for the lifetime of the run.
async function holdQuietWindow(safety) {
    const token = quietTokenFromEnv();
    const current = await readQuietWindow();
    if (current.state === 'held' && token && current.lease.token === token) return async () => {};
    const handle = await acquireQuietWindow({
        purpose: safety.purpose || 'exclusive Chromium run', minutes: safety.minutes ?? 120, pid: process.pid, ...quietWait(safety),
    });
    const previous = process.env.WATT3D_QUIET_TOKEN;
    process.env.WATT3D_QUIET_TOKEN = handle.token; // Nested launches and child scripts are the holder's own work.
    const timer = setInterval(() => { handle.heartbeat().catch(() => {}); }, 30_000);
    timer.unref();
    process.once('exit', handle.releaseSync);
    return async () => {
        clearInterval(timer);
        process.removeListener('exit', handle.releaseSync);
        if (previous === undefined) delete process.env.WATT3D_QUIET_TOKEN;
        else process.env.WATT3D_QUIET_TOKEN = previous;
        await handle.release();
    };
}

// Reserve a run before launch: shared by default, exclusive when requested.
// Ordinary runs wait (or refuse with safety.noWait / WATT3D_QUIET_NO_WAIT=1)
// while another agent holds the quiet window; the holder's own runs pass.
export async function acquireChromiumRunLock(safety = {}) {
    if (chromiumExclusiveRequested(safety)) {
        const releaseWindow = await holdQuietWindow(safety);
        let unlock;
        try { unlock = await acquireExclusiveLock(); } catch (error) { await releaseWindow(); throw error; }
        return async () => { try { await unlock(); } finally { await releaseWindow(); } };
    }
    // A held account lock is waited on with the same wait/no-wait semantics as
    // the quiet window, except when this process holds it (that would deadlock).
    const options = { ...waitOptionsFromEnv(), ...quietWait(safety) };
    const started = Date.now();
    for (;;) {
        const leave = await enterHeavyWork({ label: safety.label || 'Chromium run', kind: 'chromium', ...options,
            maxWaitMs: Math.max(0, options.maxWaitMs - (Date.now() - started)) });
        let release;
        try { release = await registerSharedRun(); } catch (error) {
            await leave();
            if (error.code !== 'EACCOUNTLOCK' || error.ownProcess) throw error;
            await waitUntilClear(async () => {
                const holder = await describeAccountLockHolder(await readJson(path.join(chromiumLockDir, 'owner.json')).catch(() => ({})));
                return holder && { message: 'safe-chromium: ' + holder.message };
            }, { ...options, maxWaitMs: Math.max(0, options.maxWaitMs - (Date.now() - started)),
                onWait: message => console.error(message) });
            continue;
        }
        return async () => { try { await release(); } finally { await leave(); } };
    }
}

function profileLockDir(root) {
    const key = process.platform === 'win32' ? root.toLowerCase() : root;
    return path.join(tmpdir(), 'watt3d-chromium-profile-' + createHash('sha256').update(key).digest('hex').slice(0, 16) + '.lock');
}

export async function prepareChromiumProfile(userDataDir, safety = {}) {
    const unlock = await acquireChromiumRunLock(safety);
    let root;
    let unlockProfile = async () => {};
    const owned = userDataDir === undefined;
    try {
        root = owned ? await fs.mkdtemp(path.join(tmpdir(), 'watt3d-chromium-profile-')) : path.resolve(userDataDir);
        // A supplied profile is reused across runs, so only one run may own it.
        if (!owned) {
            unlockProfile = await acquireDirLock(profileLockDir(root),
                pid => 'Chromium profile ' + root + ' is in use (PID ' + pid + '). Give each parallel worker its own profile.');
        }
        await seedChromiumProfile(root);
    } catch (error) {
        try { await unlockProfile(); } finally { await unlock(); }
        throw error;
    }
    let cleanup;
    return {
        userDataDir: root,
        release() {
            cleanup ||= (async () => {
                try {
                    // Only delete a directory created by this invocation.
                    if (owned) await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
                } finally {
                    try { await unlockProfile(); } finally { await unlock(); }
                }
            })();
            return cleanup;
        },
    };
}

function assertChromium(browserType) {
    if (typeof browserType?.name !== 'function' || browserType.name() !== 'chromium') {
        throw new TypeError('Pass the Playwright Chromium BrowserType to this helper');
    }
}

// Adapters with stricter failure/child ownership keep cleanup themselves. They
// must already hold a shared or exclusive run lock from acquireChromiumRunLock;
// these routes still seed and launch here, so an adapter can never
// accidentally start an unseeded process. One process may hold several shared
// registrations; an unclaimed one (pid set) is preferred over one a launch has
// already marked pending (pid null).
async function assertHeldChromiumLock() {
    const lockFile = path.join(chromiumLockDir, 'owner.json');
    const owner = await readJson(lockFile);
    if (ownedByThisProcess(owner)) return { file: lockFile, owner };
    let names = [];
    try { names = await fs.readdir(chromiumSharedDir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let pending;
    for (const name of names.filter(name => name.endsWith('.json'))) {
        const file = path.join(chromiumSharedDir, name);
        const shared = await readJson(file).catch(() => ({}));
        if (shared.pid === process.pid && shared.token) return { file, owner: shared };
        if (!pending && ownedByThisProcess(shared)) pending = { file, owner: shared };
    }
    if (pending) return pending;
    throw new Error('Chromium adapter must hold the account lock before launch');
}

// Recheck the same entry after seeding, never a fresh search.
async function recheckHeldChromiumLock(held) {
    const owner = await readJson(held.file).catch(() => ({}));
    if (!ownedByThisProcess(owner) || owner.token !== held.owner.token) {
        throw new Error('Chromium adapter lock changed during seeding');
    }
    return { file: held.file, owner };
}

export async function launchLockedChromium(chromium, userDataDir, options = {}) {
    assertChromium(chromium);
    if (!userDataDir || options.args?.some(arg => /^--(user-data-dir|profile-directory)(=|$)/.test(arg))) {
        throw new Error('Locked Chromium requires its seeded profile without overrides');
    }
    const held = await assertHeldChromiumLock();
    const root = await seedChromiumProfile(userDataDir);
    // No supported Playwright child PID: retain a fail-closed lock on a crash.
    const { file, owner } = await recheckHeldChromiumLock(held);
    await fs.writeFile(file, JSON.stringify({ ...owner, pid: null, runnerPid: process.pid }));
    return chromium.launchPersistentContext(root, options);
}

export async function spawnLockedChromium(binary, args, options = {}, spawnProcess = spawn, onSpawn = () => {}) {
    const profiles = args.filter(arg => arg.startsWith('--user-data-dir='));
    if (profiles.length !== 1 || args.some(arg => /^--(?:user-data-dir|profile-directory)$/.test(arg)
        || arg.startsWith('--profile-directory='))) {
        throw new Error('Locked CDP launch requires exactly one isolated --user-data-dir');
    }
    const held = await assertHeldChromiumLock();
    await seedChromiumProfile(profiles[0].slice('--user-data-dir='.length));
    await recheckHeldChromiumLock(held);
    const child = spawnProcess(binary, args, options);
    // Install adapter listeners synchronously before an error event can fire.
    onSpawn(child);
    return child;
}

// safety = { exclusive: true } only for CPU/GPU-timing runs; see the lock notes above.
export async function launchSafePersistentContext(chromium, userDataDir, options = {}, safety = {}) {
    assertChromium(chromium);
    if (options.args?.some(arg => /^--(user-data-dir|profile-directory)(=|$)/.test(arg))) {
        throw new Error('Profile overrides are forbidden; pass userDataDir to the helper');
    }
    const profile = await prepareChromiumProfile(userDataDir, safety);
    try {
        const context = await chromium.launchPersistentContext(profile.userDataDir, options);
        const close = context.close.bind(context);
        context.close = async (...args) => {
            await close(...args);
            await profile.release();
        };
        context.once('close', () => { profile.release().catch(error => console.error(error.message)); });
        return context;
    } catch (error) {
        await profile.release();
        throw error;
    }
}

// Preserve the Browser API used by existing scripts and Playwright's context
// fixture. Isolated browser.newContext() calls share the seeded browser process.
export async function launchSafeChromium(chromium, options = {}, safety = {}) {
    const context = await launchSafePersistentContext(chromium, undefined, options, safety);
    const browser = context.browser();
    if (!browser) {
        await context.close();
        throw new Error('Persistent Chromium did not expose a Browser');
    }
    browser.close = async () => { await context.close(); };
    return browser;
}

export async function launchSafeBrowserType(browserType, options = {}, safety = {}) {
    if (browserType.name() === 'chromium') return launchSafeChromium(browserType, options, safety);
    return browserType.launch(options); // Firefox/WebKit do not use the Windows Chromium check.
}

export function safeChromiumTest(base, safety = {}) {
    return base.extend({
        browser: [async ({ playwright, browserName, headless, channel, launchOptions }, use) => {
            const browser = await launchSafeBrowserType(playwright[browserName], {
                ...launchOptions, headless, ...(channel ? { channel } : {}),
            }, safety);
            try { await use(browser); } finally { await browser.close(); }
        }, { scope: 'worker' }],
    });
}

// For the existing CDP scripts that spawn a Chromium executable directly.
export async function spawnSafeChromium(binary, args, options = {}, safety = {}) {
    const profiles = args.filter(arg => arg.startsWith('--user-data-dir='));
    if (profiles.length !== 1 || args.some(arg => arg.startsWith('--profile-directory'))) {
        throw new Error('CDP launch requires exactly one isolated --user-data-dir');
    }
    const profile = await prepareChromiumProfile(profiles[0].slice('--user-data-dir='.length), safety);
    let child;
    try { child = spawn(binary, args, options); } catch (error) { await profile.release(); throw error; }
    child.once('close', () => { profile.release().catch(error => console.error(error.message)); });
    child.once('error', () => { profile.release().catch(error => console.error(error.message)); });
    return child;
}

// Chromium WebDriver sessions need the same seed as Playwright. Only a local
// driver can consume the local profile path; remote Chromium is refused.
export async function prepareChromiumWebDriver(browserName, baseUrl, safety = {}) {
    const name = String(browserName).toLowerCase();
    if (!['chrome', 'chromium', 'msedge', 'microsoftedge'].includes(name)) return null;
    const host = new URL(baseUrl).hostname;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
        throw new Error('Seeded Chromium WebDriver requires a local driver; remote Chromium is not supported');
    }
    const profile = await prepareChromiumProfile(undefined, safety);
    const key = ['msedge', 'microsoftedge'].includes(name) ? 'ms:edgeOptions' : 'goog:chromeOptions';
    return { ...profile, capabilities: { [key]: { args: ['--user-data-dir=' + profile.userDataDir] } } };
}
