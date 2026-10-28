# dsh-code-diff-highlight

[![npm version](https://img.shields.io/npm/v/dsh-code-diff-highlight)](https://www.npmjs.com/package/dsh-code-diff-highlight)
[![license](https://img.shields.io/npm/l/dsh-code-diff-highlight)](https://github.com/Tomson131/dsh-code-diff-highlight/blob/main/LICENSE)

A client plugin for **DeepSeek Harness** that lists the files changed by a turn
and opens each file's comparison in a dedicated **right-sidebar tab** with
custom diff highlighting.

## Features

- A **“Custom diff panel”** card at the end of every turn, listing the changed
  files with added/deleted line counts.
- **Click a file to open its diff in a separate right-sidebar tab** (not inline
  in the chat).
- **Unified** and **Side-by-side** views.
- Line numbers for both sides; green `+` / red `-`; a lightweight built-in
  syntax highlighter.
- Handles `binary`, `too large`, and `coarse` (timed-out) comparisons.
- No card is shown for turns that changed nothing.

## Install

The package is a **bundle**: installing it mounts the plugin automatically — no
manual profile edits.

```powershell
cd C:\Users\<user>\.dsh\profiles\desktop
pnpm add dsh-code-diff-highlight
```

Then add `dsh-code-diff-highlight` to `dsh.profile.bundles` in the profile's
`package.json`, or install it from the GUI: sidebar → **Plugins**.

If the GUI was already open, reload the page (F5).

## Usage

After a turn that changed files, a **“Custom diff panel”** card appears under
the reply. Click a file to open its diff in the right panel; switch between
files from within the tab.

## How it works

A Cordis client plugin (`dsh.client`, `platform: "web"`):

1. folds `workspace/changes` events into per-turn data
   (`ctx.uiConversation.events.register`);
2. registers a right-sidebar tab type and its body
   (`ctx.sidebarRightTabs.register` + the `sidebar.right.pane.tab` slot);
3. reads data through the authenticated `api/changes.summary` and
   `api/changes.diff` routes.

`lib/client.js` is a pre-built browser bundle — no build step is required.

## License

MIT
