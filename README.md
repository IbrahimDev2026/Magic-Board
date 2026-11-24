# Magic Board – Creative Drawing Studio
HMI PW2 · L3 Computer Science · Biskra University

**Run:** keep `index.html`, `style.css`, `i18n.js`, `script.js` in one folder and open `index.html` in Chrome or Edge.
`magic-board-single.html` is the same site in one file (no folder needed). No server, no install.

## What the sheet asks for → where it is
| Requirement (PDF) | In the site |
|---|---|
| Toolbar with shapes and colors | Left panel: Pen, Eraser, Line, Rectangle, Circle · 12 colors + custom · 3 thicknesses |
| Exit menu and Delete menu | **Delete:** Undo, Redo, Clear the board · **Exit:** Save drawing, Exit |
| Shapes and colors also in the menu | **Shapes** and **Colors** menus; menu, toolbar and status line always show the same state |
| Room for your own ideas | See "Extras" |
| Four zones | Menu bar · Toolbar · Board · Status line |
| Direct manipulation | Cross at the start, dashed outline while dragging, solid on release; cursor changes with the tool |
| Errors and undo | Clear acts at once and offers Undo; Exit asks only if something would be lost, with buttons that say what they do |
| Colors | Ring + tick + name, border on every swatch, contrast ≥ 7:1 for text and ≥ 3.6:1 for controls |

## Improvements made to the first version
- Single click no longer adds an empty shape (message says what to do).
- The eraser really erases (it no longer paints white), with a ring showing its size.
- Files and saved data are validated: a broken or hostile `.json` cannot crash the board; images must be embedded PNG/JPG/GIF/WebP/SVG.
- "Exit without saving" no longer triggers a second browser warning; "New board" resets cleanly.
- "Clear the board" is dimmed in the menu when the board is empty.
- Sharp on high-density screens, smoother pen strokes.
- Menus work with the keyboard (arrows, Home/End, Esc) and are announced to screen readers.
- Next step always shown in the status line (e.g. "Press at the center, drag to set the size").
- The empty board explains itself with three pictures instead of a pop-up.
- Follows the system light/dark setting; layout adapts to phones.

## Extras
- **Trace game** (T): follow a dashed shape in 30 s, get a score. Starting it clears the board, and Undo brings it back.
- **File → Copy image / Share**, Save PNG, Save project (.json), Open, drag & drop.
- **Design notes and test** (clipboard button): the four zones with their heuristics, the five-task classmate test with checkboxes and a notes field, and the See / Act / Recover checklist. Saved in the browser.
- Languages: English, العربية (right-to-left), Français.
- Shortcuts: Ctrl+Z / Y / S / O / Q · P E L R C · F fill · G grid · [ ] thickness · T game · ? guide.

## Files
`index.html` structure · `style.css` look · `i18n.js` texts (3 languages) · `script.js` logic (model = list of shapes, view = `render()`, controller = events).
