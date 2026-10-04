# Website Shortcuts Reference

Generated from `data/site-hotkeys.json` (researched 2026-10-03) by the merge script; edit the data, not this file. Research notes per group: [docs/site-hotkeys/](site-hotkeys/).

Why this exists: an extension or embedded widget that binds a hotkey runs on other people's pages. Browser and OS keys are in `data/browser-hotkeys.json` (they never reach the page). The keys here DO reach the page, and the site uses them. `hotkey-router/sites` looks them up so an app can yield on those sites unless the user is focused on the app.

Vendor help pages and keymap source, read by research agents (often through a summarizing fetch). verified=true means read on the vendor page or source in that session; false means a secondary source or inference. Sites the agents could not read have researched=false and no rows.

## Coverage

| Site | Hosts | Ctrl/Cmd+Shift | Ctrl/Cmd+Alt | Shift+Alt | Ctrl/Cmd+Alt+Shift | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| Google Docs | docs.google.com (/document/) | 29 | 26 | 14 | 11 | 80/80 |
| Google Slides | docs.google.com (/presentation/) | 19 | 17 | 14 | 11 | 61/61 |
| Gmail | mail.google.com | 13 | 2 | 0 | 0 | 15/15 |
| Google Keep | keep.google.com | 1 | 0 | 0 | 0 | 1/1 |
| Word for the web | word.cloud.microsoft, *.officeapps.live.com, onedrive.live.com, sharepoint.com (unconfirmed) | 7 | 1 | 2 | 1 | 7/11 |
| Outlook on the web | outlook.office.com, outlook.live.com, outlook.cloud.microsoft, outlook.office365.com (unconfirmed) | 4 | 5 | 5 | 0 | 13/14 |
| Microsoft Teams (web) | teams.microsoft.com, teams.live.com, teams.cloud.microsoft (unconfirmed) | 21 | 20 | 20 | 2 | 0/63 |
| OneNote for the web | onenote.cloud.microsoft, www.onenote.com, *.officeapps.live.com, onedrive.live.com (unconfirmed) | 1 | 0 | 2 | 0 | 3/3 |
| Notion | www.notion.so, www.notion.com | 23 | 0 | 0 | 0 | 21/23 |
| Slack | app.slack.com (/client/) | 30 | 9 | 2 | 1 | 42/42 |
| Discord | discord.com (/channels/) | 4 | 0 | 0 | 1 | 5/5 |
| Confluence Cloud | *.atlassian.net (/wiki/) | 15 | 26 | 1 | 6 | 47/48 |
| Jira Cloud | *.atlassian.net (/jira/, /browse/) | 0 | 0 | 0 | 0 | 0/0 |
| Linear | linear.app | 16 | 9 | 1 | 0 | 0/26 |
| GitHub | github.com | 9 | 0 | 4 | 1 | 14/14 |
| WordPress block editor (Gutenberg) | * (/wp-admin/post.php, /wp-admin/post-new.php) | 6 | 4 | 12 | 4 | 26/26 |
| Medium | medium.com | not researched | | | | |
| Reddit | www.reddit.com | not researched | | | | |
| LinkedIn | www.linkedin.com | not researched | | | | |
| X / Twitter | x.com, twitter.com | not researched | | | | |
| Substack | substack.com | not researched | | | | |

## Punctuation chords at a glance

Who uses each family with `,` `.` `;` `'` `/` (keys apps like to pick for "next / previous"). Windows notation; the Mac column is matched with Cmd in place of Ctrl.

| Chord (Windows) | Used by |
| --- | --- |
| ctrl+shift+comma | Google Docs: Decrease font size; Google Slides: Decrease font size / playback rate; Confluence Cloud: Subscript; Linear: Copy issue URL (unverified); WordPress block editor (Gutenberg): Show/hide settings sidebar |
| ctrl+shift+period | Google Docs: Increase font size; Google Slides: Increase font size / playback rate; Confluence Cloud: Superscript; Linear: Copy Git branch name (unverified); GitHub: Quote markdown (comment box, file editor) |
| ctrl+shift+semicolon | none found |
| ctrl+shift+quote | none found |
| ctrl+shift+slash | Slack: Open context menu (canvas), Mac |
| ctrl+alt+comma | Google Docs: Go to side panel (alternate); Google Slides: Go to side panel (alternate); Gmail: Switch between Calendar/Keep/Tasks sidebar and inbox |
| ctrl+alt+period | Google Docs: Go to side panel; Google Slides: Go to side panel; Gmail: Switch between Calendar/Keep/Tasks sidebar and inbox (alternate) |
| ctrl+alt+semicolon | none found |
| ctrl+alt+quote | none found |
| ctrl+alt+slash | none found |
| alt+shift+comma | Google Docs: Go to side panel (alternate); Google Slides: Go to side panel (alternate); Confluence Cloud: Subscript |
| alt+shift+period | Google Docs: Go to side panel; Google Slides: Go to side panel; Confluence Cloud: Superscript |
| alt+shift+semicolon | none found |
| alt+shift+quote | none found |
| alt+shift+slash | none found |
| ctrl+alt+shift+comma | none found |
| ctrl+alt+shift+period | none found |
| ctrl+alt+shift+semicolon | none found |
| ctrl+alt+shift+quote | none found |
| ctrl+alt+shift+slash | none found |

## System notes

Operating-system behavior that affects these families on every site (not part of site matching).

### Windows input switching (OS level)

- Windows `meta+space`: Windows+Space switches forward through input languages and layouts (Win+Shift+Space backward). Context only.
- Windows `alt+shift`: Left Alt+Shift switches input language (default when several languages are installed; can be changed or set to Not Assigned under Advanced keyboard settings, Input language hot keys) (unverified). Not on the Windows shortcuts page fetched. Default known from Microsoft settings guidance and forum answers, not read on a vendor page this session.
- Windows `ctrl+shift`: Ctrl+Shift switches keyboard layout when multiple layouts are available. Wording on the Windows shortcuts page: when multiple keyboard layouts are available, switch the keyboard layout.

Gaps: Whether the page still receives the keydown is NOT confirmed from a Microsoft page. Expected behavior (unverified): the switch triggers when the bare modifier pair is released with no other key, browsers still see keydown for Shift and Alt, and Shift+Alt+<key> chords are not stolen. Needs a live test.

## Google Docs

Hosts: docs.google.com; paths: /document/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+v | meta+shift+v | ctrl+shift+v | Paste without formatting | yes |
| Ctrl/Cmd+Shift | ctrl+shift+z | meta+shift+z | ctrl+shift+z | Redo | yes |
| Ctrl/Cmd+Shift | ctrl+shift+g | meta+shift+g | ctrl+shift+g | Find previous | yes |
| Ctrl/Cmd+Shift | ctrl+shift+f | ctrl+shift+f | ctrl+shift+f | Hide menus (compact mode) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+period | meta+shift+period | ctrl+shift+period | Increase font size | yes |
| Ctrl/Cmd+Shift | ctrl+shift+comma | meta+shift+comma | ctrl+shift+comma | Decrease font size | yes |
| Ctrl/Cmd+Shift | ctrl+shift+k | alt+shift+k |  | Small caps | yes |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l | ctrl+shift+l | Left align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+e | meta+shift+e | ctrl+shift+e | Center align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+r | meta+shift+r | ctrl+shift+r | Right align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+j | meta+shift+j | ctrl+shift+j | Justify | yes |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Numbered list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Bulleted list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+shift+9 |  | Checklist | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowup | ctrl+shift+arrowup |  | Move paragraph up | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowdown | ctrl+shift+arrowdown |  | Move paragraph down | yes |
| Ctrl/Cmd+Shift | ctrl+shift+x |  | ctrl+shift+x | Context (right-click) menu | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backslash | meta+shift+backslash |  | Context (right-click) menu (alternate) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+y | meta+shift+y | ctrl+shift+y | Open dictionary | yes |
| Ctrl/Cmd+Shift | ctrl+shift+c | meta+shift+c | ctrl+shift+c | Word count | yes |
| Ctrl/Cmd+Shift | ctrl+shift+s | meta+shift+s | ctrl+shift+s | Start voice typing | yes |
| Ctrl/Cmd+Shift |  | meta+shift+h |  | Find and replace (Mac form) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowleft |  | ctrl+shift+arrowleft | Extend selection one word left | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowright |  | ctrl+shift+arrowright | Extend selection one word right | yes |
| Ctrl/Cmd+Shift | ctrl+shift+home | meta+shift+arrowup |  | Extend selection to document start | yes |
| Ctrl/Cmd+Shift | ctrl+shift+end | meta+shift+arrowdown |  | Extend selection to document end | yes |
| Ctrl/Cmd+Shift | ctrl+shift+pagedown |  |  | Move to next tab | yes |
| Ctrl/Cmd+Shift | ctrl+shift+pageup |  |  | Move to previous tab | yes |
| Ctrl/Cmd+Shift |  | meta+shift+k |  | Toggle input controls | yes |
| Ctrl/Cmd+Alt | ctrl+alt+1 | meta+alt+1 | ctrl+alt+1 | Apply heading style 1 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+2 | meta+alt+2 | ctrl+alt+2 | Apply heading style 2 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+3 | meta+alt+3 | ctrl+alt+3 | Apply heading style 3 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+4 | meta+alt+4 | ctrl+alt+4 | Apply heading style 4 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+5 | meta+alt+5 | ctrl+alt+5 | Apply heading style 5 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+6 | meta+alt+6 | ctrl+alt+6 | Apply heading style 6 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+0 | meta+alt+0 | ctrl+alt+0 | Apply normal text style | yes |
| Ctrl/Cmd+Alt | ctrl+alt+y | meta+alt+y | ctrl+alt+y | Alt text | yes |
| Ctrl/Cmd+Alt | ctrl+alt+k | ctrl+meta+k | ctrl+alt+k | Resize larger (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+b | ctrl+meta+b | ctrl+alt+b | Resize larger horizontally (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+i | ctrl+meta+i | ctrl+alt+i | Resize larger vertically (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+j | ctrl+meta+j | ctrl+alt+j | Resize smaller (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+w | ctrl+meta+w | ctrl+alt+w | Resize smaller horizontally (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+q | ctrl+meta+q | ctrl+alt+q | Resize smaller vertically (drawing) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+m | meta+alt+m | ctrl+alt+m | Insert comment | yes |
| Ctrl/Cmd+Alt | ctrl+alt+f | meta+alt+f | ctrl+alt+f | Insert footnote | yes |
| Ctrl/Cmd+Alt | ctrl+alt+c | meta+alt+c | ctrl+alt+c | Copy text formatting | yes |
| Ctrl/Cmd+Alt | ctrl+alt+v | meta+alt+v | ctrl+alt+v | Paste text formatting | yes |
| Ctrl/Cmd+Alt | ctrl+alt+x | meta+alt+x |  | Open spelling and grammar | yes |
| Ctrl/Cmd+Alt | ctrl+alt+z | meta+alt+z | ctrl+alt+z | Enable screen reader support | yes |
| Ctrl/Cmd+Alt | ctrl+alt+h | meta+alt+h | ctrl+alt+h | Enable braille support | yes |
| Ctrl/Cmd+Alt | ctrl+alt+enter | meta+alt+enter | ctrl+alt+enter | Toggle checkbox | yes |
| Ctrl/Cmd+Alt | ctrl+alt+period | meta+alt+period | alt+shift+period | Go to side panel | yes |
| Ctrl/Cmd+Alt | ctrl+alt+comma | meta+alt+comma | alt+shift+comma | Go to side panel (alternate) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+k |  | ctrl+alt+k | Move to next edit | yes |
| Ctrl/Cmd+Alt | ctrl+alt+j |  | ctrl+alt+j | Move to previous edit | yes |
| Shift+Alt | alt+shift+5 | meta+shift+x | alt+shift+5 | Strikethrough | yes |
| Shift+Alt | alt+shift+arrowleft | alt+shift+arrowleft | alt+shift+arrowleft | Rotate counterclockwise 1 degree (drawing) | yes |
| Shift+Alt | alt+shift+arrowright | alt+shift+arrowright | alt+shift+arrowright | Rotate clockwise 1 degree (drawing) | yes |
| Shift+Alt | alt+shift+backquote |  | alt+shift+backquote | Enable screen reader support (alternate) | yes |
| Shift+Alt |  | alt+shift+arrowup |  | Extend selection one paragraph up | yes |
| Shift+Alt |  | alt+shift+arrowdown |  | Extend selection one paragraph down | yes |
| Shift+Alt | alt+shift+f | ctrl+alt+f |  | File menu | yes |
| Shift+Alt | alt+shift+e | ctrl+alt+e |  | Edit menu | yes |
| Shift+Alt | alt+shift+v | ctrl+alt+v |  | View menu | yes |
| Shift+Alt | alt+shift+i | ctrl+alt+i |  | Insert menu | yes |
| Shift+Alt | alt+shift+o | ctrl+alt+o |  | Format menu | yes |
| Shift+Alt | alt+shift+t | ctrl+alt+t |  | Tools menu | yes |
| Shift+Alt | alt+shift+h | ctrl+alt+h |  | Help menu | yes |
| Shift+Alt | alt+shift+a | ctrl+alt+a |  | Accessibility menu | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+a | meta+alt+shift+a | ctrl+alt+shift+a | Open discussion thread / comment history | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+k | meta+alt+shift+k | ctrl+alt+shift+k | Input Tools menu | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+r | meta+alt+shift+r | ctrl+alt+shift+r | Show live edits | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+m | meta+alt+shift+m | ctrl+alt+shift+m | Move focus out of editing area | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+z | meta+alt+shift+z | ctrl+alt+shift+z | Switch to editing | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+x | meta+alt+shift+x | ctrl+alt+shift+x | Switch to suggesting | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+c | meta+alt+shift+c | ctrl+alt+shift+c | Switch to viewing | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+h | meta+alt+shift+h | ctrl+alt+shift+h | Open revision history | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+i | meta+alt+shift+i | ctrl+alt+shift+i | Open Explore tool | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowleft | ctrl+meta+shift+arrowleft | ctrl+alt+shift+arrowleft | Select multiple text sections (left) | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowright | ctrl+meta+shift+arrowright | ctrl+alt+shift+arrowright | Select multiple text sections (right) | yes |

Gaps: Read via a summarizing fetch of the vendor page, not a visual read; Mac/ChromeOS nulls may just be unlisted. Ctrl+Alt then letter sequences excluded. In-app list not opened.

## Google Slides

Hosts: docs.google.com; paths: /presentation/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+z | meta+shift+z | ctrl+shift+z | Redo | yes |
| Ctrl/Cmd+Shift | ctrl+shift+g | meta+shift+g | ctrl+shift+g | Find previous | yes |
| Ctrl/Cmd+Shift | ctrl+shift+f | ctrl+shift+f | ctrl+shift+f | Hide or show menus | yes |
| Ctrl/Cmd+Shift | ctrl+shift+c | meta+shift+c | ctrl+shift+c | Turn on captions | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backslash | meta+shift+backslash |  | Context menu | yes |
| Ctrl/Cmd+Shift | ctrl+shift+x |  | ctrl+shift+x | Context menu (alternate) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowup | meta+shift+arrowup | ctrl+shift+arrowup | Move slide to beginning / Bring to front | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowdown | meta+shift+arrowdown | ctrl+shift+arrowdown | Move slide to end / Send to back | yes |
| Ctrl/Cmd+Shift | ctrl+shift+period | meta+shift+period | ctrl+shift+period | Increase font size / playback rate | yes |
| Ctrl/Cmd+Shift | ctrl+shift+comma | meta+shift+comma | ctrl+shift+comma | Decrease font size / playback rate | yes |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l |  | Left align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+r | meta+shift+r | ctrl+shift+r | Right align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+e | meta+shift+e | ctrl+shift+e | Center align | yes |
| Ctrl/Cmd+Shift | ctrl+shift+j | meta+shift+j | ctrl+shift+j | Justify | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Bulleted list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Numbered list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+k | meta+shift+k | ctrl+shift+k | Toggle input controls | yes |
| Ctrl/Cmd+Shift |  | meta+shift+h |  | Find and replace (Mac form) | yes |
| Ctrl/Cmd+Shift |  | meta+shift+f |  | Toggle full screen (present, Mac form) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+c | meta+alt+c | ctrl+alt+c | Copy formatting | yes |
| Ctrl/Cmd+Alt | ctrl+alt+v | meta+alt+v | ctrl+alt+v | Paste formatting | yes |
| Ctrl/Cmd+Alt | ctrl+alt+y | meta+alt+y | ctrl+alt+y | Alt text | yes |
| Ctrl/Cmd+Alt | ctrl+alt+m | meta+alt+m | ctrl+alt+m | Insert comment | yes |
| Ctrl/Cmd+Alt | ctrl+alt+g | meta+alt+g | ctrl+alt+g | Group | yes |
| Ctrl/Cmd+Alt | ctrl+alt+b | ctrl+meta+b | ctrl+alt+b | Resize larger horizontally | yes |
| Ctrl/Cmd+Alt | ctrl+alt+i | ctrl+meta+i | ctrl+alt+i | Resize larger vertically | yes |
| Ctrl/Cmd+Alt | ctrl+alt+j | ctrl+meta+j | ctrl+alt+j | Resize smaller | yes |
| Ctrl/Cmd+Alt | ctrl+alt+k | ctrl+meta+k | ctrl+alt+k | Resize larger | yes |
| Ctrl/Cmd+Alt | ctrl+alt+w | ctrl+meta+w | ctrl+alt+w | Resize smaller horizontally | yes |
| Ctrl/Cmd+Alt | ctrl+alt+9 |  | ctrl+alt+9 | Resize smaller vertically | yes |
| Ctrl/Cmd+Alt | ctrl+alt+x | ctrl+meta+x | ctrl+alt+x | Verbalize selection | yes |
| Ctrl/Cmd+Alt | ctrl+alt+r | ctrl+meta+r | ctrl+alt+r | Verbalize from cursor | yes |
| Ctrl/Cmd+Alt | ctrl+alt+z | meta+alt+z | ctrl+alt+z | Enable screen reader | yes |
| Ctrl/Cmd+Alt | ctrl+alt+h | meta+alt+h | ctrl+alt+h | Enable braille | yes |
| Ctrl/Cmd+Alt | ctrl+alt+period | meta+alt+period | alt+shift+period | Go to side panel | yes |
| Ctrl/Cmd+Alt | ctrl+alt+comma | meta+alt+comma | alt+shift+comma | Go to side panel (alternate) | yes |
| Shift+Alt | alt+shift+5 | meta+shift+x | alt+shift+5 | Strikethrough | yes |
| Shift+Alt | alt+shift+arrowdown | alt+shift+arrowdown |  | Move paragraph down | yes |
| Shift+Alt | alt+shift+arrowup | alt+shift+arrowup |  | Move paragraph up | yes |
| Shift+Alt | alt+shift+arrowleft | alt+shift+arrowleft | alt+shift+arrowleft | Rotate counterclockwise 1 degree | yes |
| Shift+Alt | alt+shift+arrowright | alt+shift+arrowright | alt+shift+arrowright | Rotate clockwise 1 degree | yes |
| Shift+Alt | alt+shift+backquote |  | alt+shift+backquote | Enable screen reader (alternate) | yes |
| Shift+Alt | alt+shift+f |  |  | File menu | yes |
| Shift+Alt | alt+shift+e |  |  | Edit menu | yes |
| Shift+Alt | alt+shift+v |  |  | View menu | yes |
| Shift+Alt | alt+shift+i |  |  | Insert menu | yes |
| Shift+Alt | alt+shift+o |  |  | Format menu | yes |
| Shift+Alt | alt+shift+t |  |  | Tools menu | yes |
| Shift+Alt | alt+shift+h |  |  | Help menu | yes |
| Shift+Alt | alt+shift+a |  |  | Accessibility menu | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+f | meta+alt+shift+f | ctrl+alt+shift+f | Move to filmstrip | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+c | meta+alt+shift+c | ctrl+alt+shift+c | Move to canvas | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+s | meta+alt+shift+s | ctrl+alt+shift+s | Open speaker notes | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+p | meta+alt+shift+p | ctrl+alt+shift+p | HTML view | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+b | meta+alt+shift+b | ctrl+alt+shift+b | Open animations | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+i | meta+alt+shift+i | ctrl+alt+shift+i | Open Explore | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+a | meta+alt+shift+a | ctrl+alt+shift+a | Open comment thread | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+j | meta+alt+shift+j | ctrl+alt+shift+j | Hide comment | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+g | meta+alt+shift+g | ctrl+alt+shift+g | Ungroup | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+k | meta+alt+shift+k | ctrl+alt+shift+k | Input tools menu | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+h | meta+alt+shift+h |  | Revision history | yes |

Gaps: Same fetch caveat. Slides page (answer/1696717); some rows look doubtful (Ctrl+Alt+9, Mac menus N/A). Sequences excluded.

## Gmail

Hosts: mail.google.com.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+c | meta+shift+c | ctrl+shift+c | Add cc recipients | yes |
| Ctrl/Cmd+Shift | ctrl+shift+b | meta+shift+b | ctrl+shift+b | Add bcc recipients | yes |
| Ctrl/Cmd+Shift | ctrl+shift+f | meta+shift+f | ctrl+shift+f | Access custom From | yes |
| Ctrl/Cmd+Shift | ctrl+shift+5 | meta+shift+5 | ctrl+shift+5 | Previous font | yes |
| Ctrl/Cmd+Shift | ctrl+shift+6 | meta+shift+6 | ctrl+shift+6 | Next font | yes |
| Ctrl/Cmd+Shift | ctrl+shift+minus | meta+shift+minus | ctrl+shift+minus | Decrease text size | yes |
| Ctrl/Cmd+Shift | ctrl+shift+equal | meta+shift+equal | ctrl+shift+equal | Increase text size | yes |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Numbered list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Bulleted list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+shift+9 | ctrl+shift+9 | Quote | yes |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l | ctrl+shift+l | Align left | yes |
| Ctrl/Cmd+Shift | ctrl+shift+e | meta+shift+e | ctrl+shift+e | Align center | yes |
| Ctrl/Cmd+Shift | ctrl+shift+r | meta+shift+r | ctrl+shift+r | Align right | yes |
| Ctrl/Cmd+Alt | ctrl+alt+comma | meta+alt+comma | ctrl+alt+comma | Switch between Calendar/Keep/Tasks sidebar and inbox | yes |
| Ctrl/Cmd+Alt | ctrl+alt+period | meta+alt+period | ctrl+alt+period | Switch between Calendar/Keep/Tasks sidebar and inbox (alternate) | yes |

Gaps: Page lists Ctrl/Cmd together with no ChromeOS column; ChromeOS assumed same as Windows. Shortcuts need keyboard shortcuts enabled in Gmail settings (compose formatting works regardless). No alt+shift chords found. g-sequences (g then i/s/b/t/d/a/k/l/n/p) excluded.

## Google Keep

Hosts: keep.google.com.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Toggle checkboxes | yes |

Gaps: Only one chord found in the three families; fetch summary only, so Keep may have more than listed.

## Word for the web

Hosts: word.cloud.microsoft, *.officeapps.live.com, onedrive.live.com, sharepoint.com (unconfirmed).

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+f6 |  |  | Move between ribbon and document content (Ctrl+F6 also) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowright |  |  | Select right one word | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowleft |  |  | Select left one word | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowup |  |  | Select up one paragraph | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowdown |  |  | Select down one paragraph | yes |
| Ctrl/Cmd+Shift | ctrl+shift+home |  |  | Select to beginning of document | yes |
| Ctrl/Cmd+Shift | ctrl+shift+end |  |  | Select to end of document | yes |
| Ctrl/Cmd+Alt | ctrl+alt+g |  |  | Select image | no |
| Shift+Alt | alt+shift+arrowleft |  |  | Outdent / select left by word | no |
| Shift+Alt | alt+shift+arrowright |  |  | Indent | no |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+tab |  |  | Task Switcher | no |

Gaps: Origins not verified by loading the app. Fetch tool returns summaries, so web vs desktop table boundaries on the Word page were not confirmed. Mac shortcuts for web not listed. Word web also inherits browser chords (e.g. Ctrl+Shift+N, Ctrl+Shift+T) that the page does not document. Many desktop-only chords (e.g. Ctrl+Shift+L, Ctrl+Shift+C/V format painter, Ctrl+Alt+1..3 headings) exist in Word web editing but were not confirmed.

## Outlook on the web

Hosts: outlook.office.com, outlook.live.com, outlook.cloud.microsoft, outlook.office365.com (unconfirmed).

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+r |  |  | Reply all | yes |
| Ctrl/Cmd+Shift | ctrl+shift+f |  |  | Forward message | yes |
| Ctrl/Cmd+Shift | ctrl+shift+2 |  |  | Go to calendar | yes |
| Ctrl/Cmd+Shift | ctrl+shift+1 |  |  | Go to mail / Inbox | no |
| Ctrl/Cmd+Alt | ctrl+alt+arrowleft |  |  | Calendar: previous day/period | yes |
| Ctrl/Cmd+Alt | ctrl+alt+arrowright |  |  | Calendar: next day/period | yes |
| Ctrl/Cmd+Alt | ctrl+alt+1 |  |  | Calendar: Day view | yes |
| Ctrl/Cmd+Alt | ctrl+alt+2 |  |  | Calendar: Week / work week view | yes |
| Ctrl/Cmd+Alt | ctrl+alt+4 |  |  | Calendar: Month view | yes |
| Shift+Alt | alt+shift+y |  |  | Calendar: go to today | yes |
| Shift+Alt | alt+shift+1 |  |  | Calendar: Day view (shift+alt set) | yes |
| Shift+Alt | alt+shift+2 |  |  | Calendar: Work week view | yes |
| Shift+Alt | alt+shift+3 |  |  | Calendar: Full week view | yes |
| Shift+Alt | alt+shift+4 |  |  | Calendar: Month view | yes |

Gaps: Outlook web has several selectable shortcut schemes (Outlook, Gmail, Yahoo style) in settings; only the default Outlook scheme was read. Mac columns not listed. Origins unconfirmed. Single-key and Ctrl+Enter chords are out of scope. Page was fetched as a summary so some rows (Ctrl+Shift+M new message? Ctrl+Shift+S?) may be missed.

## Microsoft Teams (web)

Hosts: teams.microsoft.com, teams.live.com, teams.cloud.microsoft (unconfirmed).

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+f | meta+shift+f |  | Open filter | no |
| Ctrl/Cmd+Shift | ctrl+shift+n | meta+shift+n |  | Start chat in new window (desktop; browser reserves new incognito window) | no |
| Ctrl/Cmd+Shift | ctrl+shift+x | meta+shift+x |  | Expand compose box | no |
| Ctrl/Cmd+Shift | ctrl+shift+c | meta+shift+c |  | Insert inline code | no |
| Ctrl/Cmd+Shift | ctrl+shift+b | meta+shift+b |  | Insert code block | no |
| Ctrl/Cmd+Shift | ctrl+shift+i | meta+shift+i |  | Mark message important | no |
| Ctrl/Cmd+Shift | ctrl+shift+a | meta+shift+a |  | Accept video call | no |
| Ctrl/Cmd+Shift | ctrl+shift+s |  |  | Accept audio call | no |
| Ctrl/Cmd+Shift | ctrl+shift+d | meta+shift+d |  | Decline call | no |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m |  | Toggle mute | no |
| Ctrl/Cmd+Shift | ctrl+shift+u |  |  | Toggle speaker | no |
| Ctrl/Cmd+Shift | ctrl+shift+o | meta+shift+o |  | Toggle video | no |
| Ctrl/Cmd+Shift | ctrl+shift+e | meta+shift+e |  | Toggle share tray | no |
| Ctrl/Cmd+Shift | ctrl+shift+h | meta+shift+h |  | End call | no |
| Ctrl/Cmd+Shift | ctrl+shift+k | meta+shift+k |  | Raise/lower hand | no |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l |  | Announce raised hands | no |
| Ctrl/Cmd+Shift | ctrl+shift+y | meta+shift+y |  | Admit from lobby | no |
| Ctrl/Cmd+Shift | ctrl+shift+j |  |  | Join from meeting toast | no |
| Ctrl/Cmd+Shift | ctrl+shift+r |  |  | Open meeting chat from notification | no |
| Ctrl/Cmd+Shift | ctrl+shift+q |  |  | Create meeting request | no |
| Ctrl/Cmd+Shift | ctrl+shift+1 |  |  | Download diagnostic logs (also: opens 1st app on web per page note) | no |
| Ctrl/Cmd+Alt | ctrl+alt+enter |  |  | Move focus to pane divider | no |
| Ctrl/Cmd+Alt | ctrl+alt+r | meta+alt+r |  | React to last message | no |
| Ctrl/Cmd+Alt | ctrl+alt+u | meta+alt+u |  | See all unread chats | no |
| Ctrl/Cmd+Alt | ctrl+alt+c | meta+alt+c |  | See all chats | no |
| Ctrl/Cmd+Alt | ctrl+alt+a | meta+alt+a |  | See all channel conversations | no |
| Ctrl/Cmd+Alt | ctrl+alt+b | meta+alt+b |  | See all meeting chats | no |
| Ctrl/Cmd+Alt | ctrl+alt+z | meta+alt+z |  | Clear all filters | no |
| Ctrl/Cmd+Alt | ctrl+alt+p | meta+alt+p |  | Paragraph style | no |
| Ctrl/Cmd+Alt | ctrl+alt+4 |  |  | Insert block quote | no |
| Ctrl/Cmd+Alt | ctrl+alt+x |  |  | Strikethrough | no |
| Ctrl/Cmd+Alt | ctrl+alt+l | meta+alt+l |  | Add Loop paragraph | no |
| Ctrl/Cmd+Alt | ctrl+alt+5 | meta+alt+4 |  | Insert code | no |
| Ctrl/Cmd+Alt | ctrl+alt+1 | meta+alt+1 |  | Heading 1 | no |
| Ctrl/Cmd+Alt | ctrl+alt+2 | meta+alt+2 |  | Heading 2 | no |
| Ctrl/Cmd+Alt | ctrl+alt+3 | meta+alt+3 |  | Heading 3 | no |
| Ctrl/Cmd+Alt | ctrl+alt+f |  |  | Forward an event | no |
| Ctrl/Cmd+Alt | ctrl+alt+k |  |  | Mark all as read (Activity) | no |
| Ctrl/Cmd+Alt | ctrl+alt+m |  |  | Filter activity to mentions | no |
| Ctrl/Cmd+Alt | ctrl+alt+arrowleft |  |  | Calendar previous day/week | no |
| Ctrl/Cmd+Alt | ctrl+alt+arrowright |  |  | Calendar next day/week | no |
| Shift+Alt | alt+shift+r | meta+shift+r |  | Reply to last message | no |
| Shift+Alt | alt+shift+o | meta+alt+o |  | Attach file | no |
| Shift+Alt | alt+shift+e |  |  | Open video recorder | no |
| Shift+Alt | alt+shift+a |  |  | Start audio call | no |
| Shift+Alt | alt+shift+v |  |  | Start video call | no |
| Shift+Alt | alt+shift+equal | meta+alt+equal |  | Zoom in shared content | no |
| Shift+Alt | alt+shift+minus | meta+alt+minus |  | Zoom out shared content | no |
| Shift+Alt | alt+shift+0 | meta+alt+0 |  | Reset zoom | no |
| Shift+Alt | alt+shift+arrowup | meta+alt+arrowup |  | Pan up | no |
| Shift+Alt | alt+shift+arrowdown | meta+alt+arrowdown |  | Pan down | no |
| Shift+Alt | alt+shift+arrowleft | meta+alt+arrowleft |  | Pan left | no |
| Shift+Alt | alt+shift+arrowright | meta+alt+arrowright |  | Pan right | no |
| Shift+Alt | alt+shift+j |  |  | Join from meeting details | no |
| Shift+Alt | alt+shift+s |  |  | Go to suggested time | no |
| Shift+Alt | alt+shift+1 |  |  | Day view | no |
| Shift+Alt | alt+shift+2 |  |  | Work week view | no |
| Shift+Alt | alt+shift+3 |  |  | Week view | no |
| Shift+Alt | alt+shift+4 |  |  | Month view | no |
| Shift+Alt | alt+shift+5 |  |  | Agenda in month view | no |
| Shift+Alt | alt+shift+y |  |  | Go to today | no |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+r | meta+alt+shift+r |  | Report a problem | no |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+1 |  |  | Download diagnostic logs | no |

Gaps: Page lists Windows desktop and Mac desktop; web differences only partly noted (page says web uses Ctrl+Shift+ instead of Ctrl+ for some navigation, e.g. Ctrl+Shift+1 for the first app). Call and meeting chords are believed to work in the browser client but not confirmed per row. Browser-reserved chords (Ctrl+Shift+N) may never reach the page. Mac mapping cross-matched by action, so a few Mac rows may be misaligned. Personal Teams page not read.

## OneNote for the web

Hosts: onenote.cloud.microsoft, www.onenote.com, *.officeapps.live.com, onedrive.live.com (unconfirmed).

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+f |  |  | Create a new outline | yes |
| Shift+Alt | alt+shift+arrowright |  |  | Increase paragraph indent | yes |
| Shift+Alt | alt+shift+arrowleft |  |  | Decrease paragraph indent | yes |

Gaps: Web section found no Ctrl+Alt chords. Windows and Mac desktop sections list many more (Ctrl+Shift+M, Ctrl+Alt+D etc.) which are desktop only and NOT recorded here. Origins unconfirmed. Fetch was a summary.

## Notion

Hosts: www.notion.so, www.notion.com.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+n | meta+shift+n | ctrl+shift+n | Open a new Notion window | yes |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l | ctrl+shift+l | Toggle dark/light mode | yes |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m | ctrl+shift+m | Create a comment | yes |
| Ctrl/Cmd+Shift | ctrl+shift+s | meta+shift+s | ctrl+shift+s | Strikethrough | yes |
| Ctrl/Cmd+Shift | ctrl+shift+u | meta+shift+u | ctrl+shift+u | Go up one level in page hierarchy | yes |
| Ctrl/Cmd+Shift | ctrl+shift+h | meta+shift+h | ctrl+shift+h | Apply last used text or highlight color | yes |
| Ctrl/Cmd+Shift |  | ctrl+shift+k |  | Previous database page in peek view | yes |
| Ctrl/Cmd+Shift |  | ctrl+shift+j |  | Next database page in peek view | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowup | meta+shift+arrowup | ctrl+shift+arrowup | Move selected block(s) up | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowdown | meta+shift+arrowdown | ctrl+shift+arrowdown | Move selected block(s) down | yes |
| Ctrl/Cmd+Shift | ctrl+shift+arrowleft | meta+shift+arrowleft | ctrl+shift+arrowleft | Move/outdent selected block(s) | no |
| Ctrl/Cmd+Shift | ctrl+shift+arrowright | meta+shift+arrowright | ctrl+shift+arrowright | Move/indent selected block(s) | no |
| Ctrl/Cmd+Shift | ctrl+shift+t | meta+alt+t | ctrl+shift+t | Expand or close all toggles in a toggle list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+0 | meta+alt+0 | ctrl+shift+0 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+1 | meta+alt+1 | ctrl+shift+1 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+2 | meta+alt+2 | ctrl+shift+2 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+3 | meta+alt+3 | ctrl+shift+3 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+4 | meta+alt+4 | ctrl+shift+4 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+5 | meta+alt+5 | ctrl+shift+5 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+6 | meta+alt+6 | ctrl+shift+6 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+alt+7 | ctrl+shift+7 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+alt+8 | ctrl+shift+8 | Turn block into text/heading/to-do/list/code/page (digit) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+alt+9 | ctrl+shift+9 | Turn block into text/heading/to-do/list/code/page (digit) | yes |

Gaps: Page read through a summarizer. Per-digit block-type mapping and the exact Windows modifier for the 0-9 and toggle shortcuts are inferred from "Cmd/Ctrl + Option/Shift". Alt+Shift+click shortcuts are mouse only and omitted.

## Slack

Hosts: app.slack.com; paths: /client/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+k | meta+shift+k | ctrl+shift+k | Compose new message / Browse DMs | yes |
| Ctrl/Cmd+Shift | ctrl+shift+2 |  | ctrl+shift+2 | Browse DMs (Windows row) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+y | meta+shift+y | ctrl+shift+y | Set status | yes |
| Ctrl/Cmd+Shift | ctrl+shift+n | meta+shift+n | ctrl+shift+n | Create new canvas | yes |
| Ctrl/Cmd+Shift | ctrl+shift+j | meta+shift+j | ctrl+shift+j | View downloaded files | yes |
| Ctrl/Cmd+Shift | ctrl+shift+enter | meta+shift+enter | ctrl+shift+enter | Create snippet | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backquote | meta+shift+backquote | ctrl+shift+backquote | Add emoji reaction | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backslash | meta+shift+backslash | ctrl+shift+backslash | Add emoji reaction (layout variant) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+h | meta+shift+h | ctrl+shift+h | Start/join/leave huddle (canvas: find and replace) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+space | meta+shift+space | ctrl+shift+space | Toggle huddle mute | yes |
| Ctrl/Cmd+Shift | ctrl+shift+w | meta+shift+w | ctrl+shift+w | Reopen last closed window | yes |
| Ctrl/Cmd+Shift | ctrl+shift+e | meta+shift+e | ctrl+shift+e | Open People view | yes |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m | ctrl+shift+m | Open Activity view | yes |
| Ctrl/Cmd+Shift | ctrl+shift+t | meta+shift+t | ctrl+shift+t | Open Threads view | yes |
| Ctrl/Cmd+Shift | ctrl+shift+l | meta+shift+l | ctrl+shift+l | Browse channels | yes |
| Ctrl/Cmd+Shift | ctrl+shift+i | meta+shift+i | ctrl+shift+i | Open conversation details | yes |
| Ctrl/Cmd+Shift | ctrl+shift+a | meta+shift+a | ctrl+shift+a | Open All unreads view | yes |
| Ctrl/Cmd+Shift | ctrl+shift+s | meta+shift+s | ctrl+shift+s | Expand/collapse workspace switcher | yes |
| Ctrl/Cmd+Shift | ctrl+shift+x | meta+shift+x | ctrl+shift+x | Strikethrough text | yes |
| Ctrl/Cmd+Shift | ctrl+shift+u | meta+shift+u | ctrl+shift+u | Hyperlink text | yes |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+shift+9 | ctrl+shift+9 | Quote text | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Bulleted list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Numbered list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+c | meta+shift+c | ctrl+shift+c | Code text | yes |
| Ctrl/Cmd+Shift | ctrl+shift+f | meta+shift+f | ctrl+shift+f | Apply markdown formatting | yes |
| Ctrl/Cmd+Shift | ctrl+shift+0 | meta+shift+0 | ctrl+shift+0 | Format as checklist (canvas) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+g | meta+shift+g | ctrl+shift+g | Find previous (canvas) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+z | meta+shift+z | ctrl+shift+z | Redo (canvas) | yes |
| Ctrl/Cmd+Shift |  | meta+shift+slash |  | Open context menu (canvas), Mac | yes |
| Ctrl/Cmd+Shift | ctrl+shift+1 |  | ctrl+shift+1 | Switch to tab by number (Shift Ctrl [number], digits 1-9) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+0 | meta+alt+0 | ctrl+alt+0 | Paragraph (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+1 | meta+alt+1 | ctrl+alt+1 | Big heading (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+2 | meta+alt+2 | ctrl+alt+2 | Medium heading (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+3 | meta+alt+3 | ctrl+alt+3 | Small heading (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+t | meta+alt+t | ctrl+alt+t | View comment thread (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+r | meta+alt+r | ctrl+alt+r | Show reader/edit view (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+arrowup | meta+alt+arrowup | ctrl+alt+arrowup | Move list item up (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+arrowdown | meta+alt+arrowdown | ctrl+alt+arrowdown | Move list item down (canvas) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+q | ctrl+alt+q | ctrl+alt+q | Copy anchor link (canvas) | yes |
| Shift+Alt | alt+shift+arrowup | alt+shift+arrowup | alt+shift+arrowup | Jump to previous unread channel/DM | yes |
| Shift+Alt | alt+shift+arrowdown | alt+shift+arrowdown | alt+shift+arrowdown | Jump to next unread channel/DM | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+c | meta+alt+shift+c | ctrl+alt+shift+c | Codeblock text | yes |

Gaps: Page read through a summarizer; Compose and Browse DMs rows conflict between platforms. Emoji reaction keys are layout-dependent; only backquote and backslash recorded. Path /client/ is general knowledge, not read on the page.

## Discord

Hosts: discord.com; paths: /channels/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m | ctrl+shift+m | Toggle mute | yes |
| Ctrl/Cmd+Shift | ctrl+shift+d | meta+shift+d | ctrl+shift+d | Toggle deafen | yes |
| Ctrl/Cmd+Shift | ctrl+shift+u | meta+shift+u | ctrl+shift+u | Attach a file to your message | yes |
| Ctrl/Cmd+Shift | ctrl+shift+b | meta+shift+b | ctrl+shift+b | Open soundboard during voice call | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+v | meta+alt+shift+v | ctrl+alt+shift+v | Return to your active voice call | yes |

Gaps: support.discord.com returned HTTP 403 for both keyboard articles, so only the blog was read. The in-app list (Ctrl/Cmd+/) is the full source. Alt+Shift+Up/Down (unread channel) is widely reported but NOT confirmed this session, so not recorded. Path /channels/ not confirmed on the page.

## Confluence Cloud

Hosts: *.atlassian.net; paths: /wiki/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Numbered list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Bullet list | yes |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+shift+9 | ctrl+shift+9 | Quote | yes |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m | ctrl+shift+m | Code | yes |
| Ctrl/Cmd+Shift | ctrl+shift+s | alt+shift+s | ctrl+shift+s | Strikethrough | yes |
| Ctrl/Cmd+Shift | ctrl+shift+comma | alt+shift+comma | ctrl+shift+comma | Subscript | yes |
| Ctrl/Cmd+Shift | ctrl+shift+period | alt+shift+period | ctrl+shift+period | Superscript | yes |
| Ctrl/Cmd+Shift | ctrl+shift+enter | meta+shift+enter | ctrl+shift+enter | Publish with note | yes |
| Ctrl/Cmd+Shift | ctrl+shift+i | ctrl+shift+i | ctrl+shift+i | Open details panel | yes |
| Ctrl/Cmd+Shift | ctrl+shift+u | meta+shift+u | ctrl+shift+u | Next unread comment | yes |
| Ctrl/Cmd+Shift | ctrl+shift+d | meta+shift+d | ctrl+shift+d | Insert markup | yes |
| Ctrl/Cmd+Shift | ctrl+shift+a | meta+shift+a | ctrl+shift+a | Macro | yes |
| Ctrl/Cmd+Shift |  | meta+shift+i |  | Insert table (Mac only per page) | no |
| Ctrl/Cmd+Shift | ctrl+shift+1 | meta+shift+1 | ctrl+shift+1 | Whiteboard: zoom to fit | yes |
| Ctrl/Cmd+Shift | ctrl+shift+2 |  | ctrl+shift+2 | Whiteboard: zoom to selection | yes |
| Ctrl/Cmd+Alt | ctrl+alt+o | meta+alt+o | ctrl+alt+o | Open notifications | yes |
| Ctrl/Cmd+Alt | ctrl+alt+h | meta+alt+h | ctrl+alt+h | Go Home | yes |
| Ctrl/Cmd+Alt | ctrl+alt+g | meta+alt+g | ctrl+alt+g | Open recent | yes |
| Ctrl/Cmd+Alt | ctrl+alt+8 | meta+alt+8 | ctrl+alt+8 | Open starred | yes |
| Ctrl/Cmd+Alt | ctrl+alt+v | meta+alt+v | ctrl+alt+v | Go to space overview | yes |
| Ctrl/Cmd+Alt | ctrl+alt+0 | meta+alt+0 | ctrl+alt+0 | Paragraph | yes |
| Ctrl/Cmd+Alt | ctrl+alt+1 | meta+alt+1 | ctrl+alt+1 | Heading 1 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+2 | meta+alt+2 | ctrl+alt+2 | Heading 2 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+3 | meta+alt+3 | ctrl+alt+3 | Heading 3 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+4 | meta+alt+4 | ctrl+alt+4 | Heading 4 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+5 | meta+alt+5 | ctrl+alt+5 | Heading 5 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+6 | meta+alt+6 | ctrl+alt+6 | Heading 6 | yes |
| Ctrl/Cmd+Alt | ctrl+alt+y | meta+alt+y | ctrl+alt+y | Highlight yellow | yes |
| Ctrl/Cmd+Alt | ctrl+alt+c | meta+alt+c | ctrl+alt+c | Comment | yes |
| Ctrl/Cmd+Alt | ctrl+alt+w | meta+alt+w | ctrl+alt+w | Watch | yes |
| Ctrl/Cmd+Alt | ctrl+alt+s | meta+alt+s | ctrl+alt+s | Share | yes |
| Ctrl/Cmd+Alt | ctrl+alt+e | meta+alt+e | ctrl+alt+e | Align center | yes |
| Ctrl/Cmd+Alt | ctrl+alt+t | meta+alt+t | ctrl+alt+t | Align right | yes |
| Ctrl/Cmd+Alt | ctrl+alt+a | ctrl+alt+a | ctrl+alt+a | Edit labels | yes |
| Ctrl/Cmd+Alt | ctrl+alt+f | ctrl+alt+f | ctrl+alt+f | Favorite content | yes |
| Ctrl/Cmd+Alt |  | ctrl+alt+c |  | Create page (Mac) | yes |
| Ctrl/Cmd+Alt |  | ctrl+alt+t |  | Attachments (Mac) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+p |  | ctrl+alt+p | Presenter mode | yes |
| Ctrl/Cmd+Alt | ctrl+alt+arrowup |  | ctrl+alt+arrowup | Table row/column operations (Ctrl+Alt+Arrow keys) | yes |
| Ctrl/Cmd+Alt | ctrl+alt+equal |  | ctrl+alt+equal | Table insert row/column | yes |
| Ctrl/Cmd+Alt | ctrl+alt+minus |  | ctrl+alt+minus | Table delete row/column | yes |
| Shift+Alt | alt+shift+z | ctrl+alt+z | alt+shift+z | Quick search | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+b | meta+alt+shift+b | ctrl+alt+shift+b | Blog post | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+r | meta+alt+shift+r | ctrl+alt+shift+r | Table resize (whiteboard/table) | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowup | meta+alt+shift+arrowup | ctrl+alt+shift+arrowup | Table column selection (Up/Down arrows) | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowdown | meta+alt+shift+arrowdown | ctrl+alt+shift+arrowdown | Table column selection | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowleft | meta+alt+shift+arrowleft | ctrl+alt+shift+arrowleft | Table row selection (Left/Right arrows) | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+arrowright | meta+alt+shift+arrowright | ctrl+alt+shift+arrowright | Table row selection | yes |

Gaps: Read through a summarizer. Mac column has odd rows (Create live doc, Select comment, Insert table) so Mac values need re-check in the in-app dialog (press ?). Windows Create page listed as Win+Alt+C. Some entries (Cmd/Ctrl+Opt navigation) may be Mac-only variants of Windows chords. Shortcuts may be globally disabled in the General tab.

## Jira Cloud

Hosts: *.atlassian.net; paths: /jira/, /browse/.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |

Modifier pattern: Access-key modifier for shortcuts that need one (Chrome/Edge on Windows: Alt+Shift; Chrome/Safari on Mac: Ctrl+Option; Firefox Windows: Alt+Shift, Firefox Mac: Ctrl) (Windows alt+shift+<key>, Mac ctrl+alt+<key>). Pattern, not a specific key. Page names no specific key; the list lives in the in-app dialog (Help, Keyboard shortcuts, or ?).

Gaps: Public page lists only single-key shortcuts (C, O, A, I, M, J, K, N, P) and the modifier pattern. No specific Ctrl+Shift or Ctrl+Alt Jira shortcuts confirmed. Shares origin with Confluence; distinguish by path.

## Linear

Hosts: linear.app.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+o | meta+shift+o | ctrl+shift+o | Create sub-issue | no |
| Ctrl/Cmd+Shift | ctrl+shift+arrowup | meta+shift+arrowup | ctrl+shift+arrowup | Open parent issue | no |
| Ctrl/Cmd+Shift | ctrl+shift+s | meta+shift+s | ctrl+shift+s | Manage subscribers | no |
| Ctrl/Cmd+Shift | ctrl+shift+m | meta+shift+m | ctrl+shift+m | Move to another team | no |
| Ctrl/Cmd+Shift | ctrl+shift+period | meta+shift+period | ctrl+shift+period | Copy Git branch name | no |
| Ctrl/Cmd+Shift | ctrl+shift+comma | meta+shift+comma | ctrl+shift+comma | Copy issue URL | no |
| Ctrl/Cmd+Shift | ctrl+shift+d | meta+shift+d | ctrl+shift+d | Remove due date | no |
| Ctrl/Cmd+Shift | ctrl+shift+1 | meta+shift+1 | ctrl+shift+1 | Go to team 1 | no |
| Ctrl/Cmd+Shift | ctrl+shift+2 | meta+shift+2 | ctrl+shift+2 | Go to team 2 | no |
| Ctrl/Cmd+Shift | ctrl+shift+3 | meta+shift+3 | ctrl+shift+3 | Go to team 3 | no |
| Ctrl/Cmd+Shift | ctrl+shift+4 | meta+shift+4 | ctrl+shift+4 | Go to team 4 | no |
| Ctrl/Cmd+Shift | ctrl+shift+5 | meta+shift+5 | ctrl+shift+5 | Go to team 5 | no |
| Ctrl/Cmd+Shift | ctrl+shift+6 | meta+shift+6 | ctrl+shift+6 | Go to team 6 | no |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 | ctrl+shift+7 | Go to team 7 | no |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 | ctrl+shift+8 | Go to team 8 | no |
| Ctrl/Cmd+Shift | ctrl+shift+9 | meta+shift+9 | ctrl+shift+9 | Go to team 9 | no |
| Ctrl/Cmd+Alt | ctrl+alt+1 | meta+alt+1 | ctrl+alt+1 | Set status by position 1 | no |
| Ctrl/Cmd+Alt | ctrl+alt+2 | meta+alt+2 | ctrl+alt+2 | Set status by position 2 | no |
| Ctrl/Cmd+Alt | ctrl+alt+3 | meta+alt+3 | ctrl+alt+3 | Set status by position 3 | no |
| Ctrl/Cmd+Alt | ctrl+alt+4 | meta+alt+4 | ctrl+alt+4 | Set status by position 4 | no |
| Ctrl/Cmd+Alt | ctrl+alt+5 | meta+alt+5 | ctrl+alt+5 | Set status by position 5 | no |
| Ctrl/Cmd+Alt | ctrl+alt+6 | meta+alt+6 | ctrl+alt+6 | Set status by position 6 | no |
| Ctrl/Cmd+Alt | ctrl+alt+7 | meta+alt+7 | ctrl+alt+7 | Set status by position 7 | no |
| Ctrl/Cmd+Alt | ctrl+alt+8 | meta+alt+8 | ctrl+alt+8 | Set status by position 8 | no |
| Ctrl/Cmd+Alt | ctrl+alt+9 | meta+alt+9 | ctrl+alt+9 | Set status by position 9 | no |
| Shift+Alt | alt+shift+f | alt+shift+f | alt+shift+f | Clear all filters | no |

Gaps: No vendor page with the full list could be read (docs URL 404; enablement guide only points to ? in-app). All entries are unverified third-party.

## GitHub

Hosts: github.com.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+7 | meta+shift+7 |  | Ordered list markdown (comment box, file editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+8 | meta+shift+8 |  | Unordered list markdown (comment box, file editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+period | meta+shift+period |  | Quote markdown (comment box, file editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+g | meta+shift+g |  | Find previous (code editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+r | meta+alt+shift+f |  | Replace all (code editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+p | meta+shift+p |  | Toggle Write/Preview tabs (comments, issues, PRs, editor) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+v | meta+shift+v |  | Paste HTML link as plain text | yes |
| Ctrl/Cmd+Shift | ctrl+shift+enter | meta+shift+enter |  | Submit a review comment (Files changed tab) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backslash | meta+shift+backslash |  | Open row actions menu (Projects) | yes |
| Shift+Alt | alt+shift+c | alt+shift+c |  | Open line menu for selected code (code view/editor) | yes |
| Shift+Alt | alt+shift+c | alt+shift+c |  | Create a new sub-issue (issues) | yes |
| Shift+Alt | alt+shift+a | alt+shift+a |  | Add an existing issue as sub-issue | yes |
| Shift+Alt | alt+shift+p | alt+shift+p |  | Edit parent issue | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+v | meta+alt+shift+v |  | Paste HTML link as plain text (alternate chord) | yes |

Gaps: No Ctrl+Alt chords listed on the docs page. markdown-toolbar-element (index.ts) defines no chords itself; github.com supplies the bold/italic hotkeys elsewhere, so the docs page is the source. The page was read through a summarizer; the Mac Cmd+Shift+P line in the editor section and the Replace all chords deserve a human recheck.

## WordPress block editor (Gutenberg)

Hosts: *; paths: /wp-admin/post.php, /wp-admin/post-new.php.

| Family | Windows | Mac | ChromeOS | Action | Verified |
| --- | --- | --- | --- | --- | --- |
| Ctrl/Cmd+Shift | ctrl+shift+comma | meta+shift+comma |  | Show/hide settings sidebar | yes |
| Ctrl/Cmd+Shift | ctrl+shift+backquote | ctrl+shift+backquote |  | Navigate to previous part of editor | yes |
| Ctrl/Cmd+Shift | ctrl+shift+z | meta+shift+z |  | Redo | yes |
| Ctrl/Cmd+Shift | ctrl+shift+0 | meta+shift+0 |  | Zoom out toggle | yes |
| Ctrl/Cmd+Shift | ctrl+shift+d | meta+shift+d |  | Duplicate selected block(s) | yes |
| Ctrl/Cmd+Shift | ctrl+shift+k | meta+shift+k |  | Remove link | yes |
| Ctrl/Cmd+Alt | ctrl+alt+t | meta+alt+t |  | Insert block before selection | yes |
| Ctrl/Cmd+Alt | ctrl+alt+y | meta+alt+y |  | Insert block after selection | yes |
| Ctrl/Cmd+Alt | ctrl+alt+v | meta+alt+v |  | Paste styles from copied block | yes |
| Ctrl/Cmd+Alt | ctrl+alt+x | meta+alt+x |  | Inline code | yes |
| Shift+Alt | alt+shift+o | ctrl+alt+o |  | Open block list view | yes |
| Shift+Alt | alt+shift+n | ctrl+alt+n |  | Navigate to next part of editor | yes |
| Shift+Alt | alt+shift+p | ctrl+alt+p |  | Navigate to previous part of editor (alternate) | yes |
| Shift+Alt | alt+shift+z | ctrl+alt+z |  | Remove selected block(s) | yes |
| Shift+Alt | alt+shift+1 | meta+alt+1 |  | Convert paragraph/heading to heading level 1 | yes |
| Shift+Alt | alt+shift+2 | meta+alt+2 |  | Convert paragraph/heading to heading level 2 | yes |
| Shift+Alt | alt+shift+3 | meta+alt+3 |  | Convert paragraph/heading to heading level 3 | yes |
| Shift+Alt | alt+shift+4 | meta+alt+4 |  | Convert paragraph/heading to heading level 4 | yes |
| Shift+Alt | alt+shift+5 | meta+alt+5 |  | Convert paragraph/heading to heading level 5 | yes |
| Shift+Alt | alt+shift+6 | meta+alt+6 |  | Convert paragraph/heading to heading level 6 | yes |
| Shift+Alt | alt+shift+0 | meta+alt+0 |  | Convert heading to paragraph | yes |
| Shift+Alt | alt+shift+h | ctrl+alt+h |  | Show list of all editor shortcuts | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+m | meta+alt+shift+m |  | Switch visual editor / code editor | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+f | meta+alt+shift+f |  | Toggle fullscreen mode | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+t | meta+alt+shift+t |  | Move selected block(s) up | yes |
| Ctrl/Cmd+Alt+Shift | ctrl+alt+shift+y | meta+alt+shift+y |  | Move selected block(s) down | yes |

Gaps: Same editor runs on wordpress.com and the site editor (/wp-admin/site-editor.php, not in pathPrefixes). Gutenberg source (keycodes package, registerShortcut calls) was not read; raw URLs returned 404. Classic editor (TinyMCE) uses Alt+Shift+letter on Windows and Ctrl+Option+letter on Mac for many letters and digits 1-6, 9; not itemized because the block editor is the target.

## Medium

Hosts: medium.com.

Not researched: help.medium.com returned 403, nothing read. No shortcuts in these families verified. Not guessed.

## Reddit

Hosts: www.reddit.com.

Not researched: Reddit help wiki could not be fetched by the tool. No verified shortcuts in these families. Not guessed.

## LinkedIn

Hosts: www.linkedin.com.

Not researched: The help URL tried returned an unrelated page; no shortcuts page read. No verified shortcuts in these families. Not guessed.

## X / Twitter

Hosts: x.com, twitter.com.

Not researched: help.x.com returned 403 and developer.x.com 402. No verified shortcuts in these families. Not guessed.

## Substack

Hosts: substack.com.

Not researched: support.substack.com returned 403. No verified shortcuts in these families. Not guessed.
