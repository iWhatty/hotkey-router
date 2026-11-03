#!/usr/bin/env node
// Canonical source: static-web-watt3d/tools/quiet-window.mjs.
// Managed copies in app scripts must stay byte-identical. Node-only tooling.
//
// A machine-wide "quiet window" lease shared by every agent (Claude Code,
// Codex, humans). While one holder runs timing-sensitive work, guarded heavy
// work (browser runs, full test suites, cargo builds) waits or refuses. See
// static-web-watt3d/docs/quiet-window.md.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const QUIET_EXIT_BUSY = 75; // EX_TEMPFAIL: held by someone else; retry later.
export const MAX_WINDOW_MINUTES = 120;
const HEARTBEAT_MS = 30_000;
const HEARTBEAT_STALE_MS = 120_000;
const GC_LOCK_STALE_MS = 10_000;
const POLL_MS = 5_000;
const REPORT_MS = 60_000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function quietWindowPaths(env = process.env) {
    const dir = env.WATT3D_QUIET_WINDOW_DIR
        || path.join(env.LOCALAPPDATA || path.join(homedir(), '.local', 'state'), 'watt3d');
    return {
        dir,
        lease: path.join(dir, 'quiet-window.json'),
        gc: path.join(dir, 'quiet-window.gc'),
        busy: path.join(dir, 'busy'),
        log: path.join(dir, 'quiet-window.log'),
    };
}

export function quietTokenFromEnv(env = process.env) {
    return env.WATT3D_QUIET_TOKEN || null;
}

export class QuietWindowBusyError extends Error {
    constructor(message, lease) {
        super(message);
        this.code = 'EQUIETBUSY';
        this.exitCode = QUIET_EXIT_BUSY;
        this.lease = lease;
    }
}

export function processAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

export function detectAgent(env = process.env) {
    if (env.WATT3D_AGENT) return env.WATT3D_AGENT;
    if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT) return 'claude';
    if (Object.keys(env).some(key => key.startsWith('CODEX_'))) return 'codex';
    return 'human';
}

export function detectRepo(start = process.cwd()) {
    let dir = path.resolve(start);
    for (;;) {
        if (existsSync(path.join(dir, '.git'))) return path.basename(dir);
        const parent = path.dirname(dir);
        if (parent === dir) return path.basename(path.resolve(start));
        dir = parent;
    }
}

export function formatDuration(ms) {
    const seconds = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m ? m + 'm ' + String(s).padStart(2, '0') + 's' : s + 's';
}

export function describeLease(lease, now = Date.now()) {
    const mode = lease.pid === null ? 'acquire, TTL only' : 'run, pid ' + lease.pid;
    return 'held by ' + lease.owner + ' (' + lease.agent + ', ' + lease.repo + ') for "' + lease.purpose
        + '", ' + formatDuration(Date.parse(lease.expiresUtc) - now) + ' left [' + mode + ']';
}

async function appendLog(paths, event) {
    const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
    await fs.appendFile(paths.log, line, 'utf8').catch(() => {});
}

// Windows can refuse a rename/unlink briefly while another process reads.
async function retryBusy(action) {
    for (let attempt = 0; ; attempt++) {
        try { return await action(); } catch (error) {
            if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= 20) throw error;
            await sleep(25);
        }
    }
}

async function readJsonFile(file) {
    for (let attempt = 0; ; attempt++) {
        let text;
        try { text = await fs.readFile(file, 'utf8'); } catch (error) {
            if (error.code === 'ENOENT') return null;
            if (['EPERM', 'EBUSY', 'EACCES'].includes(error.code) && attempt < 20) { await sleep(25); continue; }
            throw error;
        }
        try {
            const value = JSON.parse(text);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object');
            return value;
        } catch (error) {
            // Writers publish complete files by link/rename; retry briefly anyway.
            if (attempt < 4) { await sleep(50); continue; }
            throw error;
        }
    }
}

function validLease(lease) {
    return lease && typeof lease.token === 'string' && typeof lease.purpose === 'string'
        && (lease.pid === null || Number.isInteger(lease.pid))
        && Number.isFinite(Date.parse(lease.expiresUtc)) && Number.isFinite(Date.parse(lease.heartbeatUtc));
}

export function staleReason(lease, now = Date.now()) {
    if (now > Date.parse(lease.expiresUtc)) return 'expired';
    if (lease.pid !== null) {
        if (!processAlive(lease.pid)) return 'holder pid ' + lease.pid + ' exited';
        if (now - Date.parse(lease.heartbeatUtc) > HEARTBEAT_STALE_MS) return 'heartbeat stopped';
    }
    return null;
}

async function withGcLock(paths, action) {
    for (let attempt = 0; ; attempt++) {
        try { await fs.mkdir(paths.gc); break; } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            const stat = await fs.stat(paths.gc).catch(() => null);
            if (stat && Date.now() - stat.mtimeMs > GC_LOCK_STALE_MS) { await fs.rmdir(paths.gc).catch(() => {}); continue; }
            if (attempt > 200) throw new Error('quiet-window gc lock stuck: ' + paths.gc);
            await sleep(25);
        }
    }
    try { return await action(); } finally { await fs.rmdir(paths.gc).catch(() => {}); }
}

// Remove the lease only if it is still the exact one judged stale or released.
async function removeLeaseIf(paths, token, event) {
    return withGcLock(paths, async () => {
        const current = await readJsonFile(paths.lease).catch(() => null);
        if (!current || current.token !== token) return false;
        await retryBusy(() => fs.unlink(paths.lease)).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await appendLog(paths, { ...event, token, owner: current.owner, purpose: current.purpose });
        return true;
    });
}

// { state: 'free' } | { state: 'held', lease } | { state: 'corrupt', error }.
// Stale leases (expired, dead holder, stopped heartbeat) are cleared here.
export async function readQuietWindow({ paths = quietWindowPaths(), now = Date.now } = {}) {
    let lease;
    try { lease = await readJsonFile(paths.lease); } catch (error) { return { state: 'corrupt', error }; }
    if (!lease) return { state: 'free' };
    if (!validLease(lease)) return { state: 'corrupt', error: new Error('invalid lease fields') };
    const reason = staleReason(lease, now());
    if (reason) {
        await removeLeaseIf(paths, lease.token, { event: 'stale-cleared', reason });
        return readQuietWindow({ paths, now });
    }
    return { state: 'held', lease };
}

async function publishNew(paths, lease) {
    await fs.mkdir(paths.dir, { recursive: true });
    const temp = paths.lease + '.' + lease.token + '.tmp';
    await fs.writeFile(temp, JSON.stringify(lease, null, 2), 'utf8');
    try {
        await fs.link(temp, paths.lease); // Atomic create-if-absent with full content.
        return true;
    } catch (error) {
        if (error.code === 'EEXIST') return false;
        throw error;
    } finally {
        await retryBusy(() => fs.unlink(temp)).catch(() => {});
    }
}

async function replaceOwn(paths, lease) {
    const temp = paths.lease + '.' + lease.token + '.hb.tmp';
    await fs.writeFile(temp, JSON.stringify(lease, null, 2), 'utf8');
    try {
        const current = await readJsonFile(paths.lease).catch(() => null);
        if (!current || current.token !== lease.token) return false;
        await retryBusy(() => fs.rename(temp, paths.lease));
        return true;
    } finally {
        await fs.unlink(temp).catch(() => {});
    }
}

// Heavy-work registrations. A holder waits for these to drain before starting.
export async function liveBusy({ paths = quietWindowPaths() } = {}) {
    let names;
    try { names = await fs.readdir(paths.busy); } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const live = [];
    for (const name of names.filter(name => name.endsWith('.json'))) {
        const file = path.join(paths.busy, name);
        const entry = await readJsonFile(file).catch(() => null);
        if (!entry) continue; // Released while listing, or unreadable mid-write.
        if (!Number.isInteger(entry.pid) || !processAlive(entry.pid)) {
            await fs.unlink(file).catch(() => {});
            continue;
        }
        live.push(entry);
    }
    return live;
}

export async function registerBusy({ label, kind = 'heavy', pid = process.pid, paths = quietWindowPaths() } = {}) {
    const token = randomUUID();
    const file = path.join(paths.busy, token + '.json');
    await fs.mkdir(paths.busy, { recursive: true });
    await fs.writeFile(file, JSON.stringify({
        token, pid, kind, label: String(label || kind), repo: detectRepo(), startedUtc: new Date().toISOString(),
    }), { flag: 'wx' });
    let released = false;
    const release = async () => {
        if (released) return;
        released = true;
        await retryBusy(() => fs.unlink(file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    };
    release.sync = () => {
        if (released) return;
        released = true;
        try { unlinkSync(file); } catch { /* Exited holders are also swept by pid. */ }
    };
    release.token = token;
    return release;
}

// `guard` passes its own heavy-job token(s) to its child. A window acquired
// from inside that child must not wait for the guard that launched it.
export const PARENT_JOBS_ENV = 'WATT3D_QUIET_PARENT_JOBS';

export function inheritedJobTokens(env = process.env) {
    return new Set(String(env[PARENT_JOBS_ENV] || '').split(',').filter(Boolean));
}

export function childJobEnv(token, env = process.env) {
    if (!token) return env;
    return { ...env, [PARENT_JOBS_ENV]: [...inheritedJobTokens(env), token].join(',') };
}

async function waitLoop(check, { maxWaitMs, noWait, onWait, pollMs = POLL_MS, reportMs = REPORT_MS }) {
    const started = Date.now();
    let lastReport = -Infinity;
    for (;;) {
        const blocker = await check();
        if (!blocker) return;
        const waited = Date.now() - started;
        if (noWait || waited >= maxWaitMs) throw new QuietWindowBusyError(blocker.message, blocker.lease);
        if (Date.now() - lastReport >= reportMs) {
            lastReport = Date.now();
            onWait?.(blocker.message + '; waiting (' + formatDuration(waited) + ' of ' + formatDuration(maxWaitMs) + ')');
        }
        await sleep(Math.min(pollMs, Math.max(1, maxWaitMs - waited)));
    }
}

// Shared by safe-chromium.mjs for its account lock: check() returns null when
// clear, else { message }. Same wait, progress and exit-75 semantics.
export const waitUntilClear = waitLoop;

function blockerFor(result, token) {
    if (result.state === 'free') return null;
    if (result.state === 'corrupt') {
        return { message: 'quiet-window: lease unreadable (' + result.error.message
            + '); inspect with `quiet-window status`, clear with `quiet-window break --reason ...`' };
    }
    if (token && result.lease.token === token) return null; // The holder's own work.
    return { message: 'quiet-window: ' + describeLease(result.lease), lease: result.lease };
}

export function waitOptionsFromEnv(env = process.env) {
    const minutes = Number(env.WATT3D_QUIET_WAIT_MINUTES ?? 30);
    return {
        maxWaitMs: (Number.isFinite(minutes) && minutes >= 0 ? minutes : 30) * 60_000,
        noWait: env.WATT3D_QUIET_NO_WAIT === '1',
    };
}

// Register as heavy work, then look: a concurrent holder either sees this
// registration while draining, or this call sees its lease and backs off.
// Returns a release function (a no-op for the holder's own work).
export async function enterHeavyWork({ label, kind = 'heavy', token = quietTokenFromEnv(), paths = quietWindowPaths(),
    onWait = message => console.error(message), ...wait } = {}) {
    const options = { ...waitOptionsFromEnv(), ...wait };
    const started = Date.now();
    for (;;) {
        const first = await readQuietWindow({ paths });
        if (first.state === 'held' && token && first.lease.token === token) return async () => {};
        const release = await registerBusy({ label, kind, paths });
        const blocker = blockerFor(await readQuietWindow({ paths }), token);
        if (!blocker) return release;
        await release();
        const remaining = options.maxWaitMs - (Date.now() - started);
        await waitLoop(async () => blockerFor(await readQuietWindow({ paths }), token),
            { ...options, maxWaitMs: Math.max(0, remaining), onWait });
    }
}

export async function acquireQuietWindow({
    purpose, minutes = 30, pid = null, owner, agent = detectAgent(), repo = detectRepo(),
    paths = quietWindowPaths(), onWait = message => console.error(message), drainMinutes = 15, ...wait
} = {}) {
    if (!purpose || !String(purpose).trim()) throw new Error('quiet-window: --purpose is required');
    if (!(minutes > 0) || minutes > MAX_WINDOW_MINUTES) {
        throw new Error('quiet-window: --minutes must be between 1 and ' + MAX_WINDOW_MINUTES);
    }
    const options = { ...waitOptionsFromEnv(), ...wait };
    const token = randomUUID();
    const make = () => {
        const now = Date.now();
        return {
            token, owner: owner || process.env.WATT3D_AGENT_NAME || agent + '@' + repo, agent, repo,
            purpose: String(purpose), pid, cwd: process.cwd(), startedUtc: new Date(now).toISOString(),
            heartbeatUtc: new Date(now).toISOString(), expiresUtc: new Date(now + minutes * 60_000).toISOString(),
        };
    };
    let lease;
    await waitLoop(async () => {
        // A stale lease is cleared by the read, so retry the publish at once.
        for (let attempt = 0; attempt < 5; attempt++) {
            lease = make();
            if (await publishNew(paths, lease)) return null;
            const blocker = blockerFor(await readQuietWindow({ paths }), null);
            if (blocker) return blocker;
        }
        return { message: 'quiet-window: lease contended' };
    }, { ...options, onWait });
    await appendLog(paths, { event: 'acquired', token, owner: lease.owner, purpose: lease.purpose, pid, expiresUtc: lease.expiresUtc });

    let released = false;
    const handle = {
        token, lease, paths,
        async release() {
            if (released) return false;
            released = true;
            return removeLeaseIf(paths, token, { event: 'released' });
        },
        releaseSync() {
            if (released) return;
            released = true;
            try {
                const current = JSON.parse(readFileSync(paths.lease, 'utf8'));
                if (current.token === token) unlinkSync(paths.lease);
            } catch { /* Gone, replaced or unreadable: pid/TTL staleness is the backstop. */ }
        },
        async heartbeat(extendMinutes) {
            if (released) return false;
            const now = Date.now();
            lease = { ...lease, heartbeatUtc: new Date(now).toISOString() };
            if (extendMinutes) lease.expiresUtc = new Date(now + extendMinutes * 60_000).toISOString();
            handle.lease = lease;
            return replaceOwn(paths, lease);
        },
    };

    // Drain heavy work that started before the window. Other holders' work
    // never registers while the window is held, so this list only shrinks.
    // Skip this process's own registrations and the guard(s) that launched it.
    const parents = inheritedJobTokens();
    try {
        await waitLoop(async () => {
            const busy = (await liveBusy({ paths })).filter(entry =>
                (entry.pid !== process.pid || pid === null) && !parents.has(entry.token));
            if (!busy.length) return null;
            return { message: 'quiet-window: draining ' + busy.length + ' heavy job(s): '
                + busy.map(entry => entry.label + ' (' + entry.repo + ', pid ' + entry.pid + ')').join('; ') };
        }, { ...options, maxWaitMs: drainMinutes * 60_000, noWait: false, onWait });
    } catch (error) {
        await handle.release();
        throw error;
    }
    return handle;
}

export async function breakQuietWindow({ reason, paths = quietWindowPaths() } = {}) {
    if (!reason) throw new Error('quiet-window: break needs --reason');
    return withGcLock(paths, async () => {
        let current = null;
        try { current = await readJsonFile(paths.lease); } catch { /* Corrupt: remove anyway. */ }
        try { await retryBusy(() => fs.unlink(paths.lease)); } catch (error) {
            if (error.code === 'ENOENT') return false;
            throw error;
        }
        await appendLog(paths, { event: 'broken', reason, token: current?.token, owner: current?.owner, by: detectAgent() });
        return true;
    });
}

// ---------------------------------------------------------------- CLI

function quoteWindowsArg(arg) {
    if (arg && !/[\s"&|<>^()%!]/.test(arg)) return arg;
    return '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}

export function spawnCommand(command, env) {
    // One argument is a whole shell command line (`-- "pnpm test && pnpm build"`):
    // hand it to cmd.exe or sh -c verbatim.
    if (command.length === 1) return spawn(command[0], { stdio: 'inherit', shell: true, env });
    if (process.platform === 'win32') {
        // Resolve pnpm.cmd and friends through the shell; quote each argument.
        return spawn(command.map(quoteWindowsArg).join(' '), { stdio: 'inherit', shell: true, env });
    }
    return spawn(command[0], command.slice(1), { stdio: 'inherit', env });
}

function childExit(child) {
    return new Promise(resolve => {
        child.once('error', error => { console.error('quiet-window: ' + error.message); resolve(127); });
        child.once('close', (code, signal) => resolve(code ?? (signal ? 130 : 1)));
    });
}

export function parseArgs(argv) {
    const split = argv.indexOf('--');
    const head = split === -1 ? argv : argv.slice(0, split);
    const command = split === -1 ? [] : argv.slice(split + 1);
    const [verb, ...rest] = head;
    const flags = {};
    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (!arg.startsWith('--')) throw new Error('quiet-window: unexpected argument ' + arg);
        const [key, inline] = arg.slice(2).split(/=(.*)/s);
        if (['no-wait', 'json'].includes(key)) { flags[key] = true; continue; }
        const value = inline ?? rest[++i];
        if (value === undefined) throw new Error('quiet-window: --' + key + ' needs a value');
        flags[key] = value;
    }
    return { verb, flags, command };
}

function waitFlags(flags) {
    const base = waitOptionsFromEnv();
    if (flags.wait !== undefined) {
        const minutes = Number(flags.wait);
        if (!(minutes >= 0)) throw new Error('quiet-window: --wait takes minutes');
        base.maxWaitMs = minutes * 60_000;
    }
    if (flags['no-wait']) base.noWait = true;
    return base;
}

const USAGE = `quiet-window <command>
  status [--json]                         show the current holder and heavy jobs
  run --purpose ".." [--minutes N] -- <cmd>
                                          hold the window while <cmd> runs (perf work)
  acquire --purpose ".." --minutes N      hold a TTL-only window across commands
  renew --token T [--minutes N]           extend an acquired window
  release [--token T]                     release (token also read from WATT3D_QUIET_TOKEN)
  guard [--wait M | --no-wait] [--label ..] -- <cmd>
                                          run heavy <cmd> once no one else holds the window
  break --reason ".."                     remove any lease (logged); last resort
<cmd> is argv (each argument quoted) or ONE string run by the shell: -- "a && b".
Shared flags: --wait M (default 30, env WATT3D_QUIET_WAIT_MINUTES), --no-wait
(env WATT3D_QUIET_NO_WAIT=1), --drain M (run/acquire; default 15). Busy exits ${QUIET_EXIT_BUSY}.`;

async function status(flags, paths) {
    const result = await readQuietWindow({ paths });
    const busy = await liveBusy({ paths });
    if (flags.json) {
        console.log(JSON.stringify({ ...result, error: result.error?.message, busy, file: paths.lease }, null, 2));
        return 0;
    }
    if (result.state === 'free') console.log('quiet-window: FREE');
    else if (result.state === 'corrupt') console.log('quiet-window: UNREADABLE lease ' + paths.lease + ' (' + result.error.message + ')');
    else console.log('quiet-window: HELD, ' + describeLease(result.lease));
    console.log('heavy jobs: ' + (busy.length ? busy.map(entry => entry.label + ' (' + entry.repo + ', pid ' + entry.pid + ')').join('; ') : 'none'));
    return 0;
}

export async function main(argv = process.argv.slice(2), { paths = quietWindowPaths() } = {}) {
    const { verb, flags, command } = parseArgs(argv);
    const log = message => console.error(message);
    switch (verb) {
    case 'status':
        return status(flags, paths);
    case 'run': {
        if (!command.length) throw new Error('quiet-window: run needs -- <cmd>');
        const handle = await acquireQuietWindow({
            purpose: flags.purpose, minutes: Number(flags.minutes ?? MAX_WINDOW_MINUTES), pid: process.pid,
            owner: flags.owner, paths, onWait: log, drainMinutes: Number(flags.drain ?? 15), ...waitFlags(flags),
        });
        log('quiet-window: acquired for "' + handle.lease.purpose + '" until ' + handle.lease.expiresUtc);
        const timer = setInterval(() => {
            handle.heartbeat().then(ok => { if (!ok) log('quiet-window: WARNING window lost (expired or broken)'); }, () => {});
        }, HEARTBEAT_MS);
        // Windows delivers Ctrl+C/Ctrl+Break/console close to the whole console
        // group: let the child finish, then release. 'exit' is the sync backstop.
        const hold = () => log('quiet-window: signal received; releasing when the command exits');
        for (const signal of ['SIGINT', 'SIGBREAK', 'SIGTERM', 'SIGHUP']) process.on(signal, hold);
        process.on('exit', handle.releaseSync);
        const code = await childExit(spawnCommand(command, { ...process.env, WATT3D_QUIET_TOKEN: handle.token }));
        clearInterval(timer);
        await handle.release();
        log('quiet-window: released');
        return code;
    }
    case 'acquire': {
        if (!flags.minutes) throw new Error('quiet-window: acquire needs --minutes N');
        const handle = await acquireQuietWindow({
            purpose: flags.purpose, minutes: Number(flags.minutes), owner: flags.owner, paths, onWait: log,
            drainMinutes: Number(flags.drain ?? 15), ...waitFlags(flags),
        });
        console.log(handle.token);
        log('quiet-window: acquired until ' + handle.lease.expiresUtc + '. Pass WATT3D_QUIET_TOKEN=' + handle.token
            + ' to your own guarded commands; release with `quiet-window release --token ' + handle.token + '`.');
        return 0;
    }
    case 'renew': {
        const token = flags.token || quietTokenFromEnv();
        const result = await readQuietWindow({ paths });
        if (result.state !== 'held' || result.lease.token !== token) { log('quiet-window: you do not hold the window'); return 1; }
        const minutes = Number(flags.minutes ?? 30);
        if (!(minutes > 0) || minutes > MAX_WINDOW_MINUTES) throw new Error('quiet-window: --minutes must be between 1 and ' + MAX_WINDOW_MINUTES);
        const now = Date.now();
        const ok = await replaceOwn(paths, { ...result.lease, heartbeatUtc: new Date(now).toISOString(), expiresUtc: new Date(now + minutes * 60_000).toISOString() });
        log(ok ? 'quiet-window: renewed for ' + minutes + 'm' : 'quiet-window: window lost while renewing');
        return ok ? 0 : 1;
    }
    case 'release': {
        const token = flags.token || quietTokenFromEnv();
        if (!token) throw new Error('quiet-window: release needs --token or WATT3D_QUIET_TOKEN');
        const ok = await removeLeaseIf(paths, token, { event: 'released' });
        log(ok ? 'quiet-window: released' : 'quiet-window: not held with that token (already released or expired)');
        return ok ? 0 : 1;
    }
    case 'guard': {
        if (!command.length) throw new Error('quiet-window: guard needs -- <cmd>');
        const release = await enterHeavyWork({ label: flags.label || command.join(' '), paths, onWait: log, ...waitFlags(flags) });
        process.on('exit', () => release.sync?.());
        for (const signal of ['SIGINT', 'SIGBREAK', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {});
        const code = await childExit(spawnCommand(command, childJobEnv(release.token)));
        await release();
        return code;
    }
    case 'break': {
        const ok = await breakQuietWindow({ reason: flags.reason, paths });
        log(ok ? 'quiet-window: lease removed (logged)' : 'quiet-window: no lease to remove');
        return 0;
    }
    default:
        console.log(USAGE);
        return verb === undefined || verb === 'help' || verb === '--help' ? 0 : 2;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().then(code => { process.exitCode = code; }, error => {
        console.error(error.message);
        process.exitCode = error.exitCode ?? 1;
    });
}
