; scripts/key-check.ahk (AutoHotkey v1.1)
;
; Runs the key check (playground/key-check.html) in Chrome, Firefox and Edge,
; with no special keyboard. Windows decides what each physical key types, so
; the script switches the browser window to each layout (Russian, Greek,
; Hebrew, Polish), presses the keys by scan code, and the page grades them.
; Results: docs/notes/key-check-<date>-<browser>.md, one note per browser.
;
; Each browser runs in a throwaway profile (%TEMP%\hotkey-router-key-check),
; so extensions and restored tabs can't take focus and your own browser
; windows are left alone. A run log is written there too (run.log).
;
; Layouts are loaded for this session only and unloaded at the end; Windows'
; language settings are not changed. The Japanese IME checks run only when
; Japanese is already installed (Settings > Time & language > Language);
; otherwise the page reports them as not run.
;
; Run it by double-clicking, or:
;   "C:\Program Files\AutoHotkey\AutoHotkey.exe" scripts\key-check.ahk
; It starts the results server (npm run key-check) if it isn't running.
; To rerun part of it, pass a browser and check numbers:
;   ... scripts\key-check.ahk chrome 2 9
; Don't touch the keyboard or mouse while it runs. Pause stops it.

#Requires AutoHotkey v1.1.33+
#NoEnv
#SingleInstance Force
SendMode Input
SetTitleMatchMode 2
CoordMode Mouse, Window
SetWorkingDir %A_ScriptDir%\..

global PORT := 8080
global PAGE_URL := "http://127.0.0.1:" PORT "/playground/key-check.html?auto=1"
global US := "00000409"
global JAPANESE := "japanese"
global LayoutsBefore := LayoutList()
global ServerPid := 0
global Browser := 0

; Check number on the page -> layout (KLID) and the keys to press, one Send
; per step with a pause between. Keep in step with CHECKS in key-check.html.
; Keys go by virtual key + scan code, so the layout decides the character.
global Checks := []
; 1. Russian: Ctrl+I types ш, must fire mod+i
Checks.Push({id: 1, layout: "00000419", keys: ["^{vk49sc017}"]})
; 2. Russian: Ctrl+Shift+X types Ч, must fire mod+shift+x.
;    Known issue (2026-10-25, Windows 10, Chrome, Firefox and Edge alike): with
;    Russian loaded for the session only, Ctrl and Shift reach the page and
;    every key after them is lost until the layout changes, so this check
;    reads "No key reached the page". Windows' default Ctrl+Shift "switch
;    layout" shortcut is the likely cause. Expected to pass with Russian
;    installed in Windows, or with that shortcut set to "Not assigned".
Checks.Push({id: 2, layout: "00000419", keys: ["{Ctrl down}{Shift down}{vk58sc02D}{Shift up}{Ctrl up}"]})
; 3. Russian: I alone types ш, must fire nothing
Checks.Push({id: 3, layout: "00000419", keys: ["{vk49sc017}"]})
; 4. Greek: Ctrl+I types ι, must fire mod+i
Checks.Push({id: 4, layout: "00000408", keys: ["^{vk49sc017}"]})
; 5. Hebrew: Ctrl+I types ן, must fire mod+i
Checks.Push({id: 5, layout: "0000040D", keys: ["^{vk49sc017}"]})
; 6. Japanese IME: IME on, type "ka", Ctrl+I while composing (nothing fires),
;    cancel the composition, IME off. VK_IME_ON/OFF (0x16/0x1A) need Windows
;    10 1903 or later.
Checks.Push({id: 6, layout: JAPANESE, keys: ["{vk16}", "{vk4Bsc025}{vk41sc01E}", "^{vk49sc017}", "{Esc}{Esc}", "{vk1A}"]})
; 7. Japanese IME: type "ka", commit with Enter, then Ctrl+I (fires mod+i)
Checks.Push({id: 7, layout: JAPANESE, keys: ["{vk16}", "{vk4Bsc025}{vk41sc01E}", "{Enter}", "{vk1A}", "^{vk49sc017}"]})
; 8 is macOS only (Option+K).
; 9. Polish (Programmers): AltGr+A types ą, must fire nothing. AltGr is
;    LCtrl + RAlt, as Windows reports it (<^>! is hotkey syntax, not Send).
Checks.Push({id: 9, layout: "00000415", keys: ["{LCtrl down}{RAlt down}{vk41sc01E}{RAlt up}{LCtrl up}"]})
; 10. US: Ctrl+Shift+, types <, fires only the code:Comma binding
Checks.Push({id: 10, layout: US, keys: ["^+{vkBCsc033}"]})
; 11. US control: Ctrl+I fires mod+i
Checks.Push({id: 11, layout: US, keys: ["^{vk49sc017}"]})

; Each browser runs in its own throwaway profile under %TEMP%, so the user's
; extensions, restored tabs and first-run pages can't take focus, and the
; user's own browser windows are never touched. Kept between runs.
global PROFILES := A_Temp "\hotkey-router-key-check"
global LOG := PROFILES "\run.log"

EnvGet, ProgramFilesX86, ProgramFiles(x86)
browsers := [["chrome", A_ProgramFiles "\Google\Chrome\Application\chrome.exe"]
    , ["firefox", A_ProgramFiles "\Mozilla Firefox\firefox.exe"]
    , ["edge", ProgramFilesX86 "\Microsoft\Edge\Application\msedge.exe"]]

; Optional arguments: a browser name (or "all"), then check numbers, to
; rerun part of the check: key-check.ahk chrome 2 9
onlyBrowser := A_Args.Length() ? A_Args[1] : "all"
global OnlyChecks := {}
Loop % A_Args.Length() - 1
    OnlyChecks[A_Args[A_Index + 1] + 0] := true

OnExit("Cleanup")
FileCreateDir, %PROFILES%
FileDelete, %LOG%
StartServer()
japaneseHkl := FindLayout(0x0411)
Log("start; Japanese IME " (japaneseHkl ? "installed" : "not installed"))

summary := ""
for _, b in browsers {
    if (onlyBrowser != "all" && onlyBrowser != b[1])
        continue
    if !FileExist(b[2]) {
        summary .= b[1] ": not installed`n"
        continue
    }
    outcome := RunBrowser(b[1], b[2], japaneseHkl)
    Log(b[1] ": " outcome)
    summary .= b[1] ": " outcome "`n"
}
if !japaneseHkl
    summary .= "`nJapanese IME not installed: checks 6 and 7 not run."
MsgBox, 64, Key check, % "Finished.`n`n" summary "`n`nNotes are in docs\notes\key-check-*.md", 60
ExitApp

Pause::Abort("Stopped with the Pause key.")

; --- one browser ---------------------------------------------------------------

LaunchArgs(name) {
    profile := PROFILES "\" name
    FileCreateDir, %profile%
    if (name = "firefox") {
        ; A fresh Firefox profile shows welcome and default-browser pages; off.
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
        return "-profile """ profile """ -no-remote -new-instance """ PAGE_URL """"
    }
    return "--user-data-dir=""" profile """ --no-first-run --no-default-browser-check --disable-extensions --disable-sync --new-window """ PAGE_URL """"
}

RunBrowser(name, exe, japaneseHkl) {
    Run, % """" exe """ " LaunchArgs(name)
    WinWait, Key check: ready, , 45
    if ErrorLevel
        return "the page did not open (no ""Key check: ready"" window)"
    ; Let the browser finish starting, then make sure the page's tab is the
    ; one showing before typing anything.
    Sleep, 1500
    WinWait, Key check: ready, , 10
    if ErrorLevel
        return "the page opened, then something else took over the window"
    Browser := WinExist()
    WinActivate, ahk_id %Browser%
    WinWaitActive, Key check ahk_id %Browser%, , 5
    if ErrorLevel
        return "could not bring the page to the front"
    ; Click the page's overlay so keys go to the page, not the address bar.
    WinGetPos, , , w, h, ahk_id %Browser%
    cx := w // 2, cy := h // 2
    Click, %cx%, %cy%
    Sleep, 300
    Log(name ": page ready in window " Browser)

    for _, c in Checks {
        if (OnlyChecks.Count() && !OnlyChecks.HasKey(c.id))
            continue
        hkl := c.layout = JAPANESE ? japaneseHkl : LoadLayout(c.layout)
        if !hkl
            continue
        Marker(c.id)
        SetLayout(hkl)
        for _, k in c.keys {
            Guard()
            SendInput, %k%
            Sleep, 250
        }
    }

    SetLayout(LoadLayout(US))
    Guard()
    SendInput, {F10}
    WinWait, Key check: done ahk_id %Browser%, , 15
    WinGetTitle, title, ahk_id %Browser%
    WinClose, ahk_id %Browser%
    Browser := 0
    if InStr(title, "not saved")
        return "ran, but the results were NOT saved"
    return InStr(title, "Key check: done") ? "done" : "ran, but the page never said done"
}

; F9, the check number, Enter: the page starts grading that check. Typed on
; the US layout so the digits are digits.
Marker(id) {
    SetLayout(LoadLayout(US))
    Guard()
    SendInput, {F9}
    Sleep, 100
    SendInput, %id%{Enter}
    Sleep, 200
}

; Stop rather than type into whatever window or tab has focus now: the
; page's own window must be in front, still showing the key check tab.
Guard() {
    if !WinActive("Key check ahk_id " Browser) {
        WinGetTitle, now, A
        Abort("The key check page lost focus (in front now: """ now """), so the script stopped before typing anywhere else.")
    }
}

Log(message) {
    FormatTime, time, , HH:mm:ss
    WinGetTitle, front, A
    FileAppend, %time% %message% [front: %front%]`n, %LOG%, UTF-8
}

; --- keyboard layouts ------------------------------------------------------------

LoadLayout(klid) {
    return DllCall("LoadKeyboardLayout", "Str", klid, "UInt", 0, "Ptr")
}

; WM_INPUTLANGCHANGEREQUEST: switch the browser window's input layout.
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

; An installed layout or IME for a language id (0x0411 Japanese), or 0.
FindLayout(langId) {
    for _, hkl in LayoutList()
        if ((hkl & 0xFFFF) = langId)
            return hkl
    return 0
}

; --- server and cleanup ----------------------------------------------------------

; "ok": our server answers; "other": something else holds the port (another
; static server can serve the page but not save results); "" if nothing does.
ServerState() {
    try {
        http := ComObjCreate("WinHttp.WinHttpRequest.5.1")
        http.SetTimeouts(500, 500, 500, 1000)
        http.Open("GET", "http://127.0.0.1:" PORT "/key-check-server", false)
        http.Send()
        return InStr(http.ResponseText, """key-check""") ? "ok" : "other"
    } catch {
        return ""
    }
}

StartServer() {
    state := ServerState()
    if (state = "ok")
        return
    if (state = "other")
        Abort("Another server is using port " PORT " on 127.0.0.1 (perhaps python -m http.server). Stop it and run this again.")
    Run, node scripts\key-check-server.mjs, %A_WorkingDir%, Hide, ServerPid
    Loop, 50 {
        Sleep, 100
        if (ServerState() = "ok")
            return
    }
    Abort("Could not start the results server (node scripts\key-check-server.mjs). Is Node on PATH, and is port " PORT " free?")
}

Abort(message) {
    Log("stopped: " message)
    MsgBox, 48, Key check, %message%`n`nLog: %LOG%, 60
    ExitApp
}

; Close the page's window (its throwaway profile), unload the layouts this
; script loaded, close the server it started.
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
