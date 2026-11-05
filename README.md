# Musical Advent Calendar 2026

The public 25-door musical Advent calendar and its visual designer.

## First-time setup

1. In this repository open **Settings → Pages**.
2. Set **Build and deployment → Deploy from a branch**, branch **main**, folder **/(root)**; save.
3. Visit `https://interzone83.github.io/musical-advent-2026/editor.html`.
4. On the **Publish** tab, connect a **fine-grained personal access token** restricted to the two `musical-advent-2026` repositories, with **Contents: Read and write** on both. Never paste this token into chat or repository files.
5. Edit appearance, upload photos and songs, assign them to doors, **Save Draft**, and **Publish Calendar**.

The visitor page is `https://interzone83.github.io/musical-advent-2026/`.

## How it works

- `index.html`, `calendar.js`, `styles.css`: visitor-facing calendar.
- `editor.html`, `editor.js`: visual designer. The editor code is public, but GitHub authentication is required to read private drafts and save anything.
- `calendar.json`: published content for visitors, publicly readable.
- `media/photos/`, `media/music/`: public files uploaded under random, unique filenames.

Drafts and original filenames live in the **private** companion repository `musical-advent-2026-admin`, not here. Media can be uploaded before it is assigned. A 20 MB limit per file is built into the editor; smaller MP3 files are recommended.

## Important limitations

- Random filenames conceal names casually, but **do not prevent discovering public media**. GitHub Pages and published configuration are public, so date locks are for the visitor experience, not strong embargo protection.
- The GitHub token stays in the browser tab's `sessionStorage`; use a trusted device, restrict token scope to the two repositories, and disconnect when finished. Do not store a token in the source code.
- Editing the appearance produces local preview changes immediately. **Save Draft** changes private JSON only; **Publish Calendar** updates `calendar.json` publicly.
- Doors unlock on their December date in 2026. Visitors' opened-door history is stored locally in the browser.
- The music player is activated by a user tap, continues when a door is closed, and stops when a new song plays.

This is a first version; verify behaviour on the devices you intend to use before distributing the calendar.
