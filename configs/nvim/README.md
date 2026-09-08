# Minimal Neovim 0.12 config

No plugin framework — only the builtin `vim.pack` manager. 9 plugins from
vim.pack plus one that ships in this directory; everything else is Neovim 0.12
builtins (LSP via `vim.lsp.enable` + `lsp/*.lua`, code lens, treesitter
highlighting + folding + selection, diagnostics, a floating terminal for
lazygit).

This directory is `~/.config/nvim`. From the repo root: `dotter deploy` with
the `nvim` package (one link for the whole directory, so new files and
`vim.pack`'s lockfile writes land in the repo), or
`ln -s "$PWD/configs/nvim" ~/.config/nvim`. Under hyprland-multishell it stays
shared across profiles; `init.lua` loads the profile's rice-theme colours.

## Prerequisites

```sh
sudo pacman -S --needed gopls delve zls ty ruff python-debugpy lldb \
  clang lua-language-server yazi perf ripgrep fd tree-sitter-cli \
  lazygit git-delta
rustup component add rust-analyzer   # NOT the pacman package, see below
```

`rust-analyzer` on `$PATH` may be a **rustup shim** (`~/.cargo/bin/rust-analyzer`
→ `rustup`) that fails with *"Unknown binary 'rust-analyzer' in official
toolchain"* if the component isn't installed. `rustup component add
rust-analyzer` fixes it; the shim shadows any pacman-installed copy.

`lldb` supplies `lldb-dap`, which Rust, Zig **and C/C++** debugging all depend
on — without it those DAP configs fail at launch.

Toolchains (`go`, `rustup`, `zig`, `python`) are assumed present. Anything
missing from the repos: AUR or `pipx install`. `cargo` is only needed if
fff.nvim's prebuilt binary download falls back to a source build. For Python
profiling: `pipx install py-spy` (or `pacman -S py-spy`).

## Plugins

| Plugin | Purpose | Loaded |
|---|---|---|
| nvim-treesitter (main) | parser installer | startup |
| blink.cmp | completion (+ cmdline, ghost text) | startup |
| fff.nvim | file picker + live grep | deferred (index warms in background inside a git repo) |
| yazi.nvim | file manager | first `<leader>e` |
| mini.nvim: mini.ai / mini.pairs | textobjects, autopairs | first file buffer |
| mini.nvim: mini.diff | git hunk signs + overlay | first file buffer |
| mini.nvim: mini.clue | mnemonic key-group popup | first file buffer |
| nvim-dap + dap-view + dap-virtual-text | debugging | first debug keymap |
| perfanno.nvim | profile annotations | first `:Perf*` command |
| surround.nvim (`pack/plugins/start/`, not vim.pack) | `ys`/`ds`/`cs`/`S` | keymaps at startup, code on first use |

surround.nvim is a plugin of mine that lives in this config; its README, tests
and benchmarks are next to it. mini.nvim is one repo for every mini.* module,
so four plugins are one clone and one lockfile entry.

lazygit needs no plugin: `<leader>gg` runs it in a builtin floating terminal.
That float is `require('config.tui').float(cmd, { cwd, title, on_exit })` in
`lua/config/tui.lua`, ready for any other TUI.

yazi.nvim runs with its defaults (`setup({})`). Two of its keys inside yazi hand
off to plugins this config doesn't have: `<c-s>` (grep) to telescope, `<c-g>`
(replace) to grug-far. Set `integrations.grep_in_directory` to a function that
calls fff to use the first.

Coming from the older setup (mini.surround and the separate mini.* repos),
delete those copies once, which also drops them from the lockfile:

```vim
:lua vim.pack.del({ 'mini.surround', 'mini.ai', 'mini.pairs', 'mini.diff', 'mini.clue' })
```

### Versions and updating

Plugins are pinned by *tag range* in `lua/config/pack.lua`, e.g.
`version = vim.version.range('0.*')`. The lockfile records both the constraint
and the resolved commit — `rev` is always a commit hash by design, that is what
makes the lock reproducible. `perfanno.nvim` and `nvim-dap-virtual-text`
publish no tags, so they track their default branch.

```
:Update                  -- treesitter parsers + all plugins, one command
:write                   -- confirm plugin updates   (:quit discards them)
:restart                 -- reload with the new code
```

`:Update` (defined in `lua/config/pack.lua`) runs `nvim-treesitter.update()`
for the parsers, then `vim.pack.update()` for the plugins. The parser refresh
is async and reports on its own; the plugin step opens the review tab described
below. The `PackChanged` hook only reinstalls parsers when the
*nvim-treesitter plugin* revision changes — grammar repos move independently,
so `:Update` refreshes them either way. For plugins alone, use
`vim.pack.update()` directly.

Changing a `version` in `pack.lua` only rewrites the lockfile; disk state moves
on the next `vim.pack.update()`. Use `vim.pack.update(nil, { offline = true })`
to review without fetching, or `vim.pack.update({ 'blink.cmp' })` for one
plugin. Commit `nvim-pack-lock.json`.

## Keymaps (leader = space)

Mnemonic groups, SpaceVim style. Pause 300ms after a prefix and mini.clue
lists what's under it; the `desc` on each `vim.keymap.set` is what it shows.
Adding a key to a group is just naming it consistently — no registration step.

| Prefix | Group |
|---|---|
| `<leader>b` | buffer |
| `<leader>d` | debug |
| `<leader>f` | find |
| `<leader>g` | git |
| `<leader>t` | toggle |
| `<leader>x` | diagnostics |

Group labels live in `lua/config/clue.lua`; `g`, `z`, `[`, `]`, `"` and
`<C-w>` are also annotated.

| Key | Action |
|---|---|
| `<leader>ff` / `<leader>fg` | fff: find files / live grep |
| `<leader>fr` / `<leader>fw` | fff: resume picker / grep word under cursor |
| `<leader>bd` / `<leader>bo` | delete buffer / delete other buffers |
| `<leader>tw` / `<leader>ts` | toggle wrap / spell |
| `<leader>e` / `<leader>E` | yazi.nvim at current file / cwd |
| `<leader>gg` | lazygit (floating terminal) |
| `<leader>gd` | toggle mini.diff hunk overlay |
| `ys{motion}{c}` / `ds{c}` / `cs{old}{new}` / `S{c}` | surround.nvim: add / delete / change / visual |
| `ci(`, `daa`, `cif`, `ciq`, `al`/`il` | mini.ai textobjects (the next one on the line if not inside) |
| `an` / `in` (visual) | treesitter: select parent / child node (builtin) |
| `[h` / `]h`, `gh` / `gH` | mini.diff: prev/next hunk, apply / reset hunk |
| `za` / `zR` / `zM` | treesitter folds (files open unfolded) |
| `gd`, `grn`, `gra`, `grr`, `gri`, `K`, `gO` | LSP (mostly builtin defaults) |
| `<leader>th` | toggle inlay hints |
| `grx` | run code lens under cursor (builtin) |
| `<leader>xq` | diagnostics → quickfix |
| `F5/F10/F11/F12` | debug: continue / over / into / out |
| `<leader>db` / `<leader>dB` | breakpoint / conditional breakpoint |
| `<leader>dv` / `<leader>dk` / `<leader>dt` | debug view / inspect / terminate |

Format-on-save is automatic for go/rust/zig/python/c/c++/lua (gopls also
organizes imports; python formats via ruff, C/C++ via clang-format). With no
formatting server attached (not installed, still starting) the write just
happens, without a warning.

### Code lens

Builtin since 0.12: `vim.lsp.codelens.enable(true)` in `lua/config/lsp.lua`.
Neovim refreshes lenses itself as you edit (debounced) and draws them as
virtual lines for the visible rows only; `grx` runs the one under the cursor.

Support is per-server: **gopls** (generate/test/tidy/upgrade — these emit
nothing unless named in `codelenses`, so they are listed in `lsp/gopls.lua`),
**rust-analyzer** (run/debug/implementations, via `lens.enable`), **lua_ls**
(`Lua.codeLens`). **clangd has no code lens support** — it uses inlay hints
instead, so C/C++ skips this path entirely (`<leader>th` toggles hints).

### Languages

| Language | Server | Debug | Notes |
|---|---|---|---|
| Go | gopls | delve | organize-imports + gofumpt on save |
| Rust | rust-analyzer | lldb-dap | clippy on check, lenses on |
| Zig | zls | lldb-dap | build-on-save, `-fincremental` |
| Python | ty + ruff | debugpy | ty types, ruff lints/formats |
| C / C++ | clangd | lldb-dap | clang-tidy, iwyu headers, `.clang-format` |
| Lua | lua_ls | — | knows `vim` global + VIMRUNTIME |

C/C++ works best with `compile_commands.json` (`cmake
-DCMAKE_EXPORT_COMPILE_COMMANDS=1`, or `bear -- make`); `compile_flags.txt`
also works for single-directory projects.

## Debugging

- **Go**: delve (`dlv`) — debug package, debug test, attach.
- **Rust/Zig**: `lldb-dap` from the system `lldb` package; prompts for the
  binary (`target/debug/`, `zig-out/bin/`). Build with debug info first.
- **Python**: debugpy — launch current file, or attach to
  `python -m debugpy --listen 5678 ...`. The adapter runs on `/usr/bin/python3`
  (`python-debugpy`), the program on `$VIRTUAL_ENV`'s python when one is
  active, so venvs don't need debugpy installed.

## Zig incremental builds

zls runs `zig build --watch -fincremental` in the background (build-on-save)
and streams build errors into diagnostics — no terminal needed. It uses the
default `install` step unless your `build.zig` declares a `check` step, which
is preferred and much faster because nothing is emitted (`-fno-emit-bin`):

```zig
// build.zig — mirror your exe without installArtifact()
const exe_check = b.addExecutable(.{
    .name = "app",
    .root_module = exe_mod,
});
const check = b.step("check", "Check compilation");
check.dependOn(&exe_check.step);
```

Incremental compilation is still experimental upstream; if diagnostics ever
look stale, drop `-fincremental` from `build_on_save_args` in `lsp/zls.lua`.

## Profiling

Compiled languages (Go/Rust/Zig):

```sh
perf record --call-graph dwarf ./zig-out/bin/app   # or target/debug/..., go binary
nvim src/main.zig
:PerfLoadFlat        " annotate lines with sample %
:PerfHottestLines    " jump to hot spots
```

Python:

```sh
py-spy record --format raw -o py.perf -- python app.py
:PerfLoadFlameGraph  " then pick py.perf
```

Go-specific (heap, goroutines, CPU with runtime context): keep using
`go tool pprof -http=:8080 profile.out` in a browser — nothing in-editor beats
it.

## fff index — no autocmd needed

Don't wire one. fff's Rust core runs a recursive, debounced `notify` watcher
(`crates/fff-core/src/background_watcher.rs`) with a `GitStatusWorker`, so
files *and* git status stay current on their own. It also ships its own
`DirChanged` autocmd (re-index on `:cd`) and `BufEnter` (frecency tracking).
Verified: a file created outside Nvim appears in results with no rescan.

An autocmd would just force redundant full rescans. The manual escape hatches,
for the rare cases the watcher can't see (NFS/SMB, container bind mounts, or
`fs.inotify.max_user_watches` exhausted — currently 524288, so unlikely):

```lua
require('fff').scan_files()          -- full rescan
require('fff').refresh_git_status()  -- git markers only
require('fff').clear_cache('files')  -- 'files' | 'frecency' | 'all'
```

If you ever do need automation, `FocusGained` → `scan_files()` is the right
hook — not `BufWritePost`, which fires constantly and the watcher already
covers.

## Cursor shape per mode

`guicursor` (in `options.lua`) gives each mode a distinct shape *and* colour,
both hinting at what an edit will do. Colours are highlight groups
(`CursorNormal`, `CursorInsert`, …) reapplied on `ColorScheme` so a
`:colorscheme` load doesn't wipe them. Needs a terminal that honours DECSCUSR
(shape) and OSC-12 (colour) — kitty/ghostty/wezterm do; inside tmux/zellij it
passes through fine.

| Mode | Shape | Colour | Why |
|---|---|---|---|
| normal | block | lavender | resting on a character, ready to act on it |
| visual | block, blinking | mauve | selecting; blink + colour set it apart |
| insert | vertical bar, blinking | green | text lands *between* characters |
| replace | underline, blinking | red | the char beneath will be overwritten |
| operator-pending | thick underline | yellow | half-committed: waiting for a motion |
| command | vertical bar | blue | typing into the cmdline |

The palette is Catppuccin Mocha hexes; edit the table in `set_cursor_colors()`
to retheme.

## Projects (per-project ShaDa)

Starting Nvim on a **directory** (`nvim .`, `nvim ~/src/app`) or bare (`nvim`
inside a project) gives that project its own ShaDa — marks, jumplist,
registers and `v:oldfiles` no longer bleed between repos. Starting on a *file*
(`nvim foo.go`) keeps the global ShaDa. `lua/config/project.lua`, no plugin.

ShaDa is read at startup **step 16, after init.lua is sourced** (`:h
starting.txt`), which is why `project.setup()` runs during sourcing.

Files are keyed by repo root in one central store rather than written into the
project:

```
~/.local/state/nvim/shada/projects/%home%carmack%src%app.shada
```

That keeps repos clean (no `.gitignore` entry), and makes the store itself the
recent-projects list — one file per project, mtime = last visit. Dropping a
`.nvim.shada` in each project would make that list impossible to build.

| Key | Action |
|---|---|
| `<leader>fp` | recent projects (`vim.ui.select`) — cd + load its ShaDa |
| `<leader>fo` | recent files in this project (`v:oldfiles`) |

Opening a subdirectory shares the repo root's ShaDa. Note the default
`'shada'` contains `r/tmp/`, so files under `/tmp` never get marks stored.

## Git

`<leader>gg` opens lazygit in a 90% floating window. The global `<Esc><Esc>`
terminal-escape mapping is disabled in that buffer so lazygit keeps `<Esc>`;
quit with `q` as usual. On exit the config runs `:checktime`, so buffers
changed by a checkout/rebase reload automatically.

lazygit uses **delta** as its diff pager (`~/.config/lazygit/config.yml`):

```yaml
git:
  paging:
    colorArg: always
    pager: delta --dark --paging=never
```

`--paging=never` is required — lazygit does its own scrolling. Add
`--side-by-side` if you run lazygit full-screen. diff-so-fancy works the same
way (`pager: diff-so-fancy --patch`), but delta is faster and already
installed. mini.diff provides the in-editor gutter signs independently.

## Zellij?

Orthogonal to this config — nothing here needs it. It buys you persistent
sessions (detach/reattach, SSH) and side panes for `cargo watch` / `zig build`
/ `go test` / `pprof -http`. If you adopt it, install its `zellij-autolock`
plugin so its keybindings don't fight Neovim. No Neovim-side changes required.
