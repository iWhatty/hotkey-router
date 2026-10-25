# Key check — 2026-10-25, firefox on windows

- Mode: automatic (scripts/key-check.ahk)
- Browser: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0
- Languages: en-US, en
- Summary: 7 pass, 1 inconclusive, 3 not run

| # | Layout or input | Press | Expect | Result | Detail |
| --- | --- | --- | --- | --- | --- |
| 1 | Russian | Ctrl+I (types ш) | mod+i fires | pass | Fired: mod+i. |
| 2 | Russian | Ctrl+Shift+X (types Ч) | mod+shift+x fires | inconclusive | No key reached the page. |
| 3 | Russian | I alone (types ш) | nothing fires | pass | Nothing fired. |
| 4 | Greek | Ctrl+I (types ι) | mod+i fires | pass | Fired: mod+i. |
| 5 | Hebrew | Ctrl+I (types ן) | mod+i fires | pass | Fired: mod+i. |
| 6 | Japanese IME, in the text field | type "ka", then Ctrl+I before committing | nothing fires while composing | not run | Needs the Japanese IME installed. |
| 7 | Japanese IME, in the text field | type "ka", commit with Enter, then Ctrl+I | mod+i fires | not run | Needs the Japanese IME installed. |
| 8 | macOS, any layout | Option+K (types ˚) | nothing fires | not run | Only on mac. |
| 9 | Polish (Programmers) | AltGr+A (types ą) | nothing fires | pass | Nothing fired. |
| 10 | US | Ctrl+Shift+, (types <) | ctrl+shift+code:Comma fires, ctrl+shift+, does not | pass | Fired: ctrl+shift+code:Comma. |
| 11 | US (control) | Ctrl+I | mod+i fires | pass | Fired: mod+i. |

## Keys per check

| Check | key | code | Modifiers | Composing | keyCode | Target | Fired |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | "ш" | KeyI | Ctrl | false | 73 | body | mod+i |
| 3 | "ш" | KeyI |  | false | 73 | body | — |
| 4 | "ι" | KeyI | Ctrl | false | 73 | body | mod+i |
| 5 | "ן" | KeyI | Ctrl | false | 73 | body | mod+i |
| 9 | "ą" | KeyA | AltGraph | false | 65 | body | — |
| 10 | "<" | Comma | Ctrl+Shift | false | 188 | body | ctrl+shift+code:Comma |
| 11 | "i" | KeyI | Ctrl | false | 73 | body | mod+i |

## Every keydown, modifiers included

In order. Check `-` means no check was running (a key the markers missed).

| Check | key | code | Modifiers | Composing |
| --- | --- | --- | --- | --- |
| 1 | "Control" | ControlLeft | Ctrl | false |
| 1 | "ш" | KeyI | Ctrl | false |
| 2 | "Control" | ControlLeft | Ctrl | false |
| 2 | "Shift" | ShiftLeft | Ctrl+Shift | false |
| 3 | "ш" | KeyI |  | false |
| 4 | "Control" | ControlLeft | Ctrl | false |
| 4 | "ι" | KeyI | Ctrl | false |
| 5 | "Control" | ControlLeft | Ctrl | false |
| 5 | "ן" | KeyI | Ctrl | false |
| 9 | "Control" | ControlLeft | Ctrl | false |
| 9 | "AltGraph" | AltRight | AltGraph | false |
| 9 | "ą" | KeyA | AltGraph | false |
| 10 | "Control" | ControlLeft | Ctrl | false |
| 10 | "Shift" | ShiftLeft | Ctrl+Shift | false |
| 10 | "<" | Comma | Ctrl+Shift | false |
| 11 | "Control" | ControlLeft | Ctrl | false |
| 11 | "i" | KeyI | Ctrl | false |
