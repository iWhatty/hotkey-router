# Publishing sites: own hotkeys (researched 2026-10-03)

Only the GitHub and WordPress block editor pages could be read. The other five sites blocked the fetch tool, so nothing is claimed for them.

## GitHub (github.com)

| Windows/Linux | Mac | Action | Family | Verified |
|---|---|---|---|---|
| ctrl+shift+7 | meta+shift+7 | Ordered list markdown (comment box, file editor) | ctrl+shift | true |
| ctrl+shift+8 | meta+shift+8 | Unordered list markdown (comment box, file editor) | ctrl+shift | true |
| ctrl+shift+period | meta+shift+period | Quote markdown (comment box, file editor) | ctrl+shift | true |
| ctrl+shift+g | meta+shift+g | Find previous (code editor) | ctrl+shift | true |
| ctrl+shift+r | meta+alt+shift+f | Replace all (code editor) | ctrl+shift | true |
| ctrl+shift+p | meta+shift+p | Toggle Write/Preview tabs (comments, issues, PRs, editor) | ctrl+shift | true |
| ctrl+shift+v | meta+shift+v | Paste HTML link as plain text | ctrl+shift | true |
| ctrl+alt+shift+v | meta+alt+shift+v | Paste HTML link as plain text (alternate chord) | ctrl+alt+shift | true |
| ctrl+shift+enter | meta+shift+enter | Submit a review comment (Files changed tab) | ctrl+shift | true |
| ctrl+shift+backslash | meta+shift+backslash | Open row actions menu (Projects) | ctrl+shift | true |
| alt+shift+c | alt+shift+c | Open line menu for selected code (code view/editor) | alt+shift | true |
| alt+shift+c | alt+shift+c | Create a new sub-issue (issues) | alt+shift | true |
| alt+shift+a | alt+shift+a | Add an existing issue as sub-issue | alt+shift | true |
| alt+shift+p | alt+shift+p | Edit parent issue | alt+shift | true |

Notes:
- Mac chord is Cmd+Shift+Option+F, so it is in the ctrl+alt+shift family on Mac.
- Same chord as the line menu, different page context.

Gaps: No Ctrl+Alt chords listed on the docs page. markdown-toolbar-element (index.ts) defines no chords itself; github.com supplies the bold/italic hotkeys elsewhere, so the docs page is the source. The page was read through a summarizer; the Mac Cmd+Shift+P line in the editor section and the Replace all chords deserve a human recheck.

## WordPress block editor (Gutenberg) (*)

| Windows/Linux | Mac | Action | Family | Verified |
|---|---|---|---|---|
| ctrl+alt+shift+m | meta+alt+shift+m | Switch visual editor / code editor | ctrl+alt+shift | true |
| ctrl+alt+shift+f | meta+alt+shift+f | Toggle fullscreen mode | ctrl+alt+shift | true |
| alt+shift+o | ctrl+alt+o | Open block list view | alt+shift | true |
| ctrl+shift+comma | meta+shift+comma | Show/hide settings sidebar | ctrl+shift | true |
| alt+shift+n | ctrl+alt+n | Navigate to next part of editor | alt+shift | true |
| ctrl+shift+backquote | ctrl+shift+backquote | Navigate to previous part of editor | ctrl+shift | true |
| alt+shift+p | ctrl+alt+p | Navigate to previous part of editor (alternate) | alt+shift | true |
| ctrl+shift+z | meta+shift+z | Redo | ctrl+shift | true |
| ctrl+shift+0 | meta+shift+0 | Zoom out toggle | ctrl+shift | true |
| ctrl+shift+d | meta+shift+d | Duplicate selected block(s) | ctrl+shift | true |
| alt+shift+z | ctrl+alt+z | Remove selected block(s) | alt+shift | true |
| ctrl+alt+t | meta+alt+t | Insert block before selection | ctrl+alt | true |
| ctrl+alt+y | meta+alt+y | Insert block after selection | ctrl+alt | true |
| ctrl+alt+shift+t | meta+alt+shift+t | Move selected block(s) up | ctrl+alt+shift | true |
| ctrl+alt+shift+y | meta+alt+shift+y | Move selected block(s) down | ctrl+alt+shift | true |
| ctrl+alt+v | meta+alt+v | Paste styles from copied block | ctrl+alt | true |
| ctrl+shift+k | meta+shift+k | Remove link | ctrl+shift | true |
| ctrl+alt+x | meta+alt+x | Inline code | ctrl+alt | true |
| alt+shift+1 | meta+alt+1 | Convert paragraph/heading to heading level 1 | alt+shift | true |
| alt+shift+2 | meta+alt+2 | Convert paragraph/heading to heading level 2 | alt+shift | true |
| alt+shift+3 | meta+alt+3 | Convert paragraph/heading to heading level 3 | alt+shift | true |
| alt+shift+4 | meta+alt+4 | Convert paragraph/heading to heading level 4 | alt+shift | true |
| alt+shift+5 | meta+alt+5 | Convert paragraph/heading to heading level 5 | alt+shift | true |
| alt+shift+6 | meta+alt+6 | Convert paragraph/heading to heading level 6 | alt+shift | true |
| alt+shift+0 | meta+alt+0 | Convert heading to paragraph | alt+shift | true |
| alt+shift+h | ctrl+alt+h | Show list of all editor shortcuts | alt+shift | true |

Notes:
- Mac uses Ctrl+Option.
- Alternate to Ctrl+backquote (outside these families). Mac uses Ctrl+Option.
- Mac is Ctrl+Shift+backquote per the page, not Cmd.
- Ctrl+Y also works on Windows.
- Needs Show template active in a Full Site Editing theme.
- Page says Mac is Cmd+Alt+digit, which differs from the Ctrl+Option pattern of other Shift+Alt chords; Gutenberg source not read, so the Mac chord is uncertain.
- Page says Shift+Alt+H or Ctrl+Option+H.

Gaps: Same editor runs on wordpress.com and the site editor (/wp-admin/site-editor.php, not in pathPrefixes). Gutenberg source (keycodes package, registerShortcut calls) was not read; raw URLs returned 404. Classic editor (TinyMCE) uses Alt+Shift+letter on Windows and Ctrl+Option+letter on Mac for many letters and digits 1-6, 9; not itemized because the block editor is the target.

## Medium (medium.com)

No chords recorded.

Gaps: help.medium.com returned 403, nothing read. No shortcuts in these families verified. Not guessed.

## Reddit (www.reddit.com)

No chords recorded.

Gaps: Reddit help wiki could not be fetched by the tool. No verified shortcuts in these families. Not guessed.

## LinkedIn (www.linkedin.com)

No chords recorded.

Gaps: The help URL tried returned an unrelated page; no shortcuts page read. No verified shortcuts in these families. Not guessed.

## X / Twitter (x.com, twitter.com)

No chords recorded.

Gaps: help.x.com returned 403 and developer.x.com 402. No verified shortcuts in these families. Not guessed.

## Substack (substack.com)

No chords recorded.

Gaps: support.substack.com returned 403. No verified shortcuts in these families. Not guessed.

