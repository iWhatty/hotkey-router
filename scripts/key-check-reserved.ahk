; scripts/key-check-reserved.ahk (AutoHotkey v1.1)
;
; Real-key check of the keys data/browser-hotkeys.json marks "hard" on
; Windows: does the page see Ctrl+letter, can preventDefault stop the
; browser's own action, or does the browser act first? Simulated keys
; (playwright) skip the browser's shortcuts, so only real presses can tell.
;
; Opens playground/key-check-reserved.html in Chrome, Firefox and Edge (each
; in a throwaway profile under %TEMP%\hotkey-router-key-check\reserved-*),
; presses each Ctrl+letter on the US layout, then looks at the windows:
; which window is in front, which windows appeared. The page reports its side
; (keydown, handler fired, focus lost, tab hidden, unloaded) to the results
; server. Events from both go to %TEMP%\hotkey-router-key-check\probe.jsonl;
; node scripts/key-check-reserved-report.mjs turns that into a note.
;
; After each key it undoes what the browser did: closes windows and dialogs
; that appeared (only the test browser's own), closes a tab that took over
; (Ctrl+W, only when the page's tab is no longer showing), presses Esc twice
; (find bar, print preview, address bar), and clicks the page. It never
; presses Enter, so nothing is printed or saved. Keys that open or close
; windows go last: Ctrl+R (reload), Ctrl+T (new tab), Ctrl+N (new window),
; Ctrl+W (closes the page's own tab, ending that browser's run).
;
; With "control", a second pass opens the page with ?bound=0 (no bindings)
; and presses the keys that open UI inside the window (CONTROL_KEYS), to show
; what the browser does when nothing stops it, and that the check notices.
;
; It takes turns with you: before each key (and each browser) it waits until
; the keyboard and mouse have been idle for 10 seconds, so if you start using
; the PC it pauses, and picks up when you leave. Pause stops it.
;
; Run it by double-clicking (the QUICK keys in each browser, about a minute
; when nobody is using the PC), or:
;   "C:\Program Files\AutoHotkey\AutoHotkey.exe" scripts\key-check-reserved.ahk [browser|all] [all|control|letters...]
;   ... key-check-reserved.ahk all all control   every key, plus the control pass
;   ... key-check-reserved.ahk chrome x y h      only those keys, in Chrome
; Rerun it when reviewing the browser table (docs/data-review.md), not often:
; the results only change when a browser changes its reserved keys.

#Requires AutoHotkey v1.1.33+
#NoEnv
#SingleInstance Force
#InstallKeybdHook
#InstallMouseHook
SendMode Input
SetTitleMatchMode 2
CoordMode Mouse, Window
SetWorkingDir %A_ScriptDir%\..

global PORT := 8080
global PAGE_URL := "http://127.0.0.1:" PORT "/playground/key-check-reserved.html"
global Pass := "bound"
global PAGE_TITLE := "Reserved key check"
global US := "00000409"
global LayoutsBefore := LayoutList()
global ServerPid := 0
global Browser := 0
global BrowserName := ""

; Keep in step with LETTERS in key-check-reserved.html. Editing keys first,
; then keys that open browser UI in the window, then the ones that reload,
; open or close tabs and windows. Ctrl+I and Ctrl+Q are not in the table.
global KEYS := ["a", "c", "v", "x", "z", "y", "b", "d", "e", "f", "g", "h", "j", "k", "l", "m", "o", "p", "s", "u", "r", "t", "n", "w"]
global CONTROL_KEYS := ["e", "f", "g", "k", "l", "p"]
; The default run: the keys apps most want (find, palette, print, save,
; address bar) and the three that stay hard, as a check that nothing moved.
global QUICK := ["f", "k", "p", "s", "l", "t", "n", "w"]
global IDLE_MS := 10000

global PROFILES := A_Temp "\hotkey-router-key-check"
global LOG := PROFILES "\run-reserved.log"

EnvGet, ProgramFilesX86, ProgramFiles(x86)
browsers := [["chrome", A_ProgramFiles "\Google\Chrome\Application\chrome.exe"]
    , ["firefox", A_ProgramFiles "\Mozilla Firefox\firefox.exe"]
    , ["edge", ProgramFilesX86 "\Microsoft\Edge\Application\msedge.exe"]]

onlyBrowser := A_Args.Length() ? A_Args[1] : "all"
global OnlyKeys := {}
keyList := QUICK
passes := ["bound"]
Loop % A_Args.Length() - 1 {
    arg := A_Args[A_Index + 1]
    if (arg = "all")
        keyList := KEYS
    else if (arg = "control")
        passes.Push("unbound")
    else
        OnlyKeys[arg] := true
}
if OnlyKeys.Count()
    keyList := KEYS

OnExit("Cleanup")
FileCreateDir, %PROFILES%
FileDelete, %LOG%
StartServer()
Log("start")

summary := ""
for _, b in browsers {
    if (onlyBrowser != "all" && onlyBrowser != b[1])
        continue
    if !FileExist(b[2]) {
        summary .= b[1] ": not installed`n"
        continue
    }
    BrowserName := b[1]
    for _, pass in passes {
        Pass := pass
        WaitForIdle()
        outcome := RunBrowser(b[1], b[2], pass = "bound" ? keyList : CONTROL_KEYS)
        Log(b[1] " " pass ": " outcome)
        Post("{""source"":""script"",""browser"":""" b[1] """,""pass"":""" pass """,""type"":""end"",""outcome"":""" Json(outcome) """}")
        summary .= b[1] " " pass ": " outcome "`n"
        Sleep, 2000
    }
}
MsgBox, 64, Reserved key check, % "Finished.`n`n" summary "`nWrite the note with:`nnode scripts\key-check-reserved-report.mjs", 60
ExitApp

Pause::Abort("Stopped with the Pause key.")

; --- one browser ---------------------------------------------------------------

LaunchArgs(name) {
    profile := PROFILES "\reserved-" name
    FileCreateDir, %profile%
    if (name = "firefox") {
        FileDelete, %profile%\user.js
        prefs =
        (LTrim
            user_pref("browser.shell.checkDefaultBrowser", false);
            user_pref("browser.aboutwelcome.enabled", false);
            user_pref("trailhead.firstrun.didSeeAboutWelcome", true);
            user_pref("browser.startup.homepage_override.mstone", "ignore");
            user_pref("startup.homepage_welcome_url", "");
            user_pref("startup.homepage_welcome_url.additional", "");
            user_pref("browser.startup.page", 0);
            user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
            user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
            user_pref("browser.tabs.warnOnClose", false);
        )
        FileAppend, %prefs%, %profile%\user.js
        return "-profile """ profile """ -no-remote -new-instance """ PageUrl() """"
    }
    return "--user-data-dir=""" profile """ --no-first-run --no-default-browser-check --disable-extensions --disable-sync --new-window """ PageUrl() """"
}

PageUrl() {
    return PAGE_URL (Pass = "unbound" ? "?bound=0" : "")
}

RunBrowser(name, exe, keys) {
    Run, % """" exe """ " LaunchArgs(name)
    WinWait, %PAGE_TITLE%: ready, , 45
    if ErrorLevel
        return "the page did not open"
    Sleep, 1500
    WinWait, %PAGE_TITLE%: ready, , 10
    if ErrorLevel
        return "the page opened, then something else took over the window"
    Browser := WinExist()
    WinGet, pid, PID, ahk_id %Browser%
    WinActivate, ahk_id %Browser%
    WinWaitActive, ahk_id %Browser%, , 5
    ; Maximize, then let the window settle, so a late resize isn't read as
    ; a sidebar opening.
    WinMaximize, ahk_id %Browser%
    Sleep, 1500
    SetLayout(LoadLayout(US))
    Log(name ": page ready in window " Browser " (pid " pid ")")
    Post("{""source"":""script"",""browser"":""" name """,""pass"":""" Pass """,""type"":""start""}")

    for _, letter in keys {
        if (OnlyKeys.Count() && !OnlyKeys.HasKey(letter))
            continue
        WaitForIdle()
        if !EnsurePage()
            return "stopped before Ctrl+" letter ": could not get the page back in front with focus"
        before := WindowsOf(pid)
        Post("{""source"":""script"",""browser"":""" name """,""pass"":""" Pass """,""type"":""press"",""key"":""ctrl+" letter """}")
        vk := Format("{:02X}", Asc(Format("{:U}", letter)))
        ; Last look before typing: another app may have come to the front.
        if !WinActive(PAGE_TITLE " ahk_id " Browser)
            return "stopped before Ctrl+" letter ": another window came to the front"
        SendInput, ^{vk%vk%}
        Sleep, 1000

        ; What the browser did, as seen from outside the page.
        WinGetTitle, frontTitle, A
        WinGetClass, frontClass, A
        front := WinExist("A")
        WinGet, frontPid, PID, ahk_id %front%
        pageExists := WinExist("ahk_id " Browser) ? "true" : "false"
        WinGetTitle, pageTitle, ahk_id %Browser%
        newWindows := ""
        fresh := []
        for _, id in WindowsOf(pid) {
            if Contains(before, id)
                continue
            WinGetTitle, t, ahk_id %id%
            WinGetClass, c, ahk_id %id%
            newWindows .= (newWindows = "" ? "" : ",") "{""class"":""" Json(c) """,""title"":""" Json(t) """}"
            fresh.Push(id)
        }
        Post("{""source"":""script"",""browser"":""" name """,""type"":""observe"",""key"":""ctrl+" letter """"
            . ",""frontIsPage"":" (front = Browser ? "true" : "false")
            . ",""frontIsOtherApp"":" (frontPid != pid ? "true" : "false")
            . ",""frontTitle"":""" Json(frontTitle) """,""frontClass"":""" Json(frontClass) """"
            . ",""pageWindow"":" pageExists ",""pageTitle"":""" Json(pageTitle) """"
            . ",""pageTabShowing"":" (InStr(pageTitle, PAGE_TITLE) ? "true" : "false")
            . ",""newWindows"":[" newWindows "]}")

        Post("{""source"":""script"",""browser"":""" name """,""type"":""cleanup"",""key"":""ctrl+" letter """}")
        undone := Undo(fresh)
        Post("{""source"":""script"",""browser"":""" name """,""type"":""idle"",""undone"":""" Json(undone) """}")
        if !WinExist("ahk_id " Browser) {
            Browser := 0
            return letter = "w" ? "done (Ctrl+W closed the page's window)" : "the page's window closed after Ctrl+" letter
        }
    }
    WinClose, ahk_id %Browser%
    Browser := 0
    return "done"
}

; Put things back after a key: close the windows that appeared, close a tab
; that took over, Esc out of in-window UI, click the page. Returns what it did.
Undo(fresh) {
    did := ""
    for _, id in fresh {
        WinGetClass, c, ahk_id %id%
        WinClose, ahk_id %id%
        WinWaitClose, ahk_id %id%, , 3
        did .= "closed window " c (ErrorLevel ? " (still open)" : "") "; "
    }
    if !WinExist("ahk_id " Browser)
        return did "page window gone"
    WinActivate, ahk_id %Browser%
    WinWaitActive, ahk_id %Browser%, , 3
    ; A reload passes through a title without ours; wait it out first.
    WinWait, %PAGE_TITLE% ahk_id %Browser%, , 4
    Loop, 3 {
        WinGetTitle, title, ahk_id %Browser%
        if InStr(title, PAGE_TITLE)
            break
        if !WinActive("ahk_id " Browser)
            Abort("Another window is in front while undoing (" BrowserName "); stopped before typing.")
        SendInput, ^{vk57}
        did .= "closed tab """ title """; "
        Sleep, 1000
    }
    if !WinActive("ahk_id " Browser)
        return did "page window not in front"
    SendInput, {Esc}
    Sleep, 300
    SendInput, {Esc}
    Sleep, 300
    ClickPage()
    return did "Esc Esc, click"
}

ClickPage() {
    if !WinActive("ahk_id " Browser)
        return
    WinGetPos, , , w, h, ahk_id %Browser%
    cx := w // 2, cy := (h * 3) // 5
    Click, %cx%, %cy%
    Sleep, 400
}

; Take turns: wait while someone is using the keyboard or mouse. Only real
; input counts (the hooks tell it from the script's own keys and clicks).
WaitForIdle() {
    if (A_TimeIdlePhysical >= IDLE_MS)
        return
    Log("waiting: someone is using the PC")
    while (A_TimeIdlePhysical < IDLE_MS) {
        ToolTip, % "Reserved key check is waiting for you to finish.`nIt goes on " (IDLE_MS // 1000) " s after your last key or mouse move. Pause stops it."
        Sleep, 500
    }
    ToolTip
}

; The page's window is in front, its tab showing, and the page has focus.
EnsurePage() {
    Loop, 3 {
        if !WinExist("ahk_id " Browser)
            return false
        WinActivate, ahk_id %Browser%
        WinWaitActive, %PAGE_TITLE% ahk_id %Browser%, , 3
        if (!ErrorLevel && InStr(PageState(), """focused"":true"))
            return true
        if WinActive("ahk_id " Browser)
            ClickPage()
        Sleep, 500
    }
    return false
}

WindowsOf(pid) {
    WinGet, list, List, ahk_pid %pid%
    ids := []
    Loop, %list%
        ids.Push(list%A_Index%)
    return ids
}

Contains(arr, v) {
    for _, x in arr
        if (x = v)
            return true
    return false
}

Json(s) {
    s := StrReplace(s, "\", "\\")
    s := StrReplace(s, """", "\""")
    s := StrReplace(s, "`n", "\n")
    s := StrReplace(s, "`r", "")
    s := StrReplace(s, "`t", " ")
    return s
}

Log(message) {
    FormatTime, time, , HH:mm:ss
    WinGetTitle, front, A
    FileAppend, %time% %message% [front: %front%]`n, %LOG%, UTF-8
}

; --- server ----------------------------------------------------------------------

Http(method, path, body := "") {
    try {
        http := ComObjCreate("WinHttp.WinHttpRequest.5.1")
        http.SetTimeouts(500, 500, 1000, 2000)
        http.Open(method, "http://127.0.0.1:" PORT path, false)
        if (body != "")
            http.SetRequestHeader("Content-Type", "application/json")
        http.Send(body)
        return http.ResponseText
    } catch {
        return ""
    }
}

Post(body) {
    if (Http("POST", "/probe", body) = "")
        Abort("Could not send an event to the results server.")
}

PageState() {
    return Http("GET", "/probe/state")
}

StartServer() {
    state := Http("GET", "/key-check-server")
    if InStr(state, """key-check""") {
        if (PageState() = "")
            Abort("The server on port " PORT " is an older key-check server without /probe. Stop it and run this again.")
        return
    }
    if (state != "")
        Abort("Another server is using port " PORT " on 127.0.0.1. Stop it and run this again.")
    Run, node scripts\key-check-server.mjs, %A_WorkingDir%, Hide, ServerPid
    Loop, 50 {
        Sleep, 100
        if InStr(Http("GET", "/key-check-server"), """key-check""")
            return
    }
    Abort("Could not start the results server (node scripts\key-check-server.mjs).")
}

; --- keyboard layout -------------------------------------------------------------

LoadLayout(klid) {
    return DllCall("LoadKeyboardLayout", "Str", klid, "UInt", 0, "Ptr")
}

SetLayout(hkl) {
    PostMessage, 0x50, 0, % hkl, , ahk_id %Browser%
    Sleep, 300
}

LayoutList() {
    n := DllCall("GetKeyboardLayoutList", "Int", 0, "Ptr", 0)
    VarSetCapacity(buf, n * A_PtrSize, 0)
    DllCall("GetKeyboardLayoutList", "Int", n, "Ptr", &buf)
    list := []
    Loop, %n%
        list.Push(NumGet(buf, (A_Index - 1) * A_PtrSize, "Ptr"))
    return list
}

Abort(message) {
    Log("stopped: " message)
    MsgBox, 48, Reserved key check, %message%`n`nLog: %LOG%, 60
    ExitApp
}

Cleanup() {
    if Browser
        WinClose, ahk_id %Browser%
    for _, hkl in LayoutList() {
        loadedBefore := false
        for _, old in LayoutsBefore
            if (old = hkl)
                loadedBefore := true
        if !loadedBefore
            DllCall("UnloadKeyboardLayout", "Ptr", hkl)
    }
    if ServerPid
        Process, Close, %ServerPid%
}
