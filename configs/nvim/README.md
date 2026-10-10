# Minimal Neovim 0.12 config

No plugin framework, only the builtin `vim.pack` manager: 9 plugins from
vim.pack plus one that ships in this directory. Everything else is Neovim 0.12
builtins (LSP via `vim.lsp.enable` + `lsp/*.lua`, code lens, treesitter
highlighting + folding + selection, diagnostics, a floating terminal for
lazygit).

This directory is `~/.config/nvim`: `dotter deploy` with the `nvim` package
(one link for the whole directory, so new files and `vim.pack`'s lockfile
writes land in the repo), or `ln -s "$PWD/configs/nvim" ~/.config/nvim`. Under
hyprland-multishell every profile shares it; colours follow the profile's
palette unless locked (see [Theme](#theme)).

## Prerequisites

```sh
sudo pacman -S --needed gopls delve zls ty ruff python-debugpy lldb \
  clang lua-language-server yazi perf ripgrep fd tree-sitter-cli \
  lazygit git-delta
rustup component add rust-analyzer   # NOT the pacman package, see below
```

- `rust-analyzer` on `$PATH` may be a rustup shim that fails with *"Unknown
  binary 'rust-analyzer' in official toolchain"* until the component is added;
  the shim also shadows a pacman copy.
- `lldb` supplies `lldb-dap`, which Rust, Zig and C/C++ debugging need.
- Toolchains (`go`, `rustup`, `zig`, `python`) are assumed. Anything missing
  from the repos: AUR or `uv tool install` (e.g. `py-spy` for Python
  profiling). `cargo` is only needed if fff.nvim's prebuilt binary falls back
  to a source build.
- yazi.nvim 14 needs yazi 26.8.15 or newer; `:checkhealth yazi` compares.

## Plugins

| Plugin | Purpose | Loaded |
|---|---|---|
| nvim-treesitter (main) | parser installer | startup |
| blink.cmp | completion (+ cmdline, ghost text) | startup |
| fff.nvim | file picker + live grep | deferred (index warms in background inside a git repo) |
| yazi.nvim + plenary.nvim | file manager | first `<leader>e` |
| mini.nvim: mini.ai / mini.pairs | textobjects, autopairs | first file buffer |
| mini.nvim: mini.diff | git hunk signs + overlay | first file buffer |
| mini.nvim: mini.clue | mnemonic key-group popup | first file buffer |
| nvim-dap + nvim-dap-view | debugging, inline variable values | first debug keymap |
| perfanno.nvim | profile annotations | first `:Perf*` command |
| surround.nvim (`pack/plugins/start/`, not vim.pack) | `ys`/`ds`/`cs`/`S` | keymaps at startup, code on first use |

- surround.nvim is mine; its README, tests and benchmarks sit next to it.
  mini.nvim is one repo, so its four modules are one clone and one lockfile
  entry.
- yazi.nvim runs with its defaults. Two keys inside yazi hand off to plugins
  this config lacks: `<c-s>` (grep → telescope) and `<c-g>` (replace →
  grug-far). Point `integrations.grep_in_directory` at fff for the first.
- vim.pack resolves no dependencies, and no plugin here ships a
  [packspec](https://packspec.org/) `pkg.json`. `pack.lua` lists plenary for
  yazi.nvim by hand (see the comment there).
- fff keeps its index and git status current with its own file watcher; no
  autocmd needed. Where the watcher can't see (NFS, bind mounts):
  `require('fff').scan_files()`.

### Versions and updating

Plugins are pinned by tag range in `lua/config/pack.lua`
(`version = vim.version.range('0.*')`); the lockfile records the constraint
and the resolved commit. perfanno.nvim and plenary.nvim track their default
branch (no usable tags).

```
:Update     -- treesitter parsers + all plugins
:write      -- confirm the plugin updates in the review tab (:quit discards)
:restart    -- reload with the new code
```

Changing a `version` only rewrites the lockfile; disk state moves on the next
`vim.pack.update()`. `vim.pack.update(nil, { offline = true })` reviews
without fetching; `vim.pack.update({ 'blink.cmp' })` updates one plugin.
Commit `nvim-pack-lock.json`.

## Keymaps (leader = space)

Mnemonic groups, SpaceVim style: pause 300ms after a prefix and mini.clue lists
what's under it, using each keymap's `desc`. Group labels are in
`lua/config/clue.lua`; `g`, `z`, `[`, `]`, `"` and `<C-w>` are annotated too.

| Prefix | Group |
|---|---|
| `<leader>b` | buffer |
| `<leader>d` | debug |
| `<leader>f` | find |
| `<leader>g` | git |
| `<leader>t` | toggle |
| `<leader>x` | diagnostics |

| Key | Action |
|---|---|
| `<leader>ff` / `<leader>fg` | fff: find files / live grep |
| `<leader>fr` / `<leader>fw` | fff: resume picker / grep word under cursor |
| `<leader>fp` / `<leader>fo` | recent projects / recent files in this project |
| `<leader>bd` / `<leader>bo` | delete buffer / delete other buffers |
| `<leader>tw` / `<leader>ts` | toggle wrap / spell |
| `<leader>e` / `<leader>E` | yazi.nvim at current file / cwd |
| `<leader>gg` | lazygit (floating terminal) |
| `<leader>gd` | toggle mini.diff hunk overlay |
| `ys{motion}{c}` / `ds{c}` / `cs{old}{new}` / `S{c}` | surround.nvim: add / delete / change / visual |
| `ci(`, `daa`, `cif`, `ciq` | mini.ai textobjects (the next one on the line if not inside; `l` for the last, as in `cil(`) |
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

Format-on-save covers go/rust/zig/python/c/c++/lua (gopls also organizes
imports; python formats via ruff, C/C++ via clang-format). With no formatting
server attached the write just happens, without a warning.

### Code lens

Builtin since 0.12 (`vim.lsp.codelens.enable(true)` in `lua/config/lsp.lua`):
refreshed as you edit, drawn for the visible rows; `grx` runs the one under the
cursor. gopls emits only the lenses named in `lsp/gopls.lua`; rust-analyzer
(run/debug/implementations) and lua_ls (`Lua.codeLens`) emit theirs. clangd has
none; it has inlay hints (`<leader>th`).

### Languages

| Language | Server | Debug | Notes |
|---|---|---|---|
| Go | gopls | delve: package, test, attach | organize-imports + gofumpt on save |
| Rust | rust-analyzer | lldb-dap: prompts in `target/debug/` | clippy on check, lenses on |
| Zig | zls | lldb-dap: prompts in `zig-out/bin/` | build-on-save, `-fincremental` |
| Python | ty + ruff | debugpy: current file, or attach to `:5678` | ty types, ruff lints/formats |
| C / C++ | clangd | lldb-dap: prompts in `build/` | clang-tidy, iwyu headers, `.clang-format` |
| Lua | lua_ls | — | knows `vim` global + VIMRUNTIME |

- Build with debug info before debugging compiled code.
- debugpy's adapter runs on `/usr/bin/python3` (`python-debugpy`) and the
  program on `$VIRTUAL_ENV`'s python, so venvs don't need debugpy.
- C/C++ wants `compile_commands.json` (`cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=1`
  or `bear -- make`); `compile_flags.txt` works for one-directory projects.
- zls builds on save (`zig build --watch -fincremental`) into diagnostics. A
  `check` step in `build.zig` (the exe without `installArtifact()`) is used
  when present and is much faster. Stale diagnostics: drop `-fincremental` in
  `lsp/zls.lua`.

## Profiling

```sh
perf record --call-graph dwarf ./zig-out/bin/app   # Go/Rust/Zig binaries
:PerfLoadFlat         " annotate lines with sample %
:PerfHottestLines     " jump to hot spots

py-spy record --format raw -o py.perf -- python app.py
:PerfLoadFlameGraph   " then pick py.perf
```

For Go heap/goroutine profiles, `go tool pprof -http=:8080 profile.out` still
beats anything in-editor.

## Theme

`lua/config/theme.lua`. Unlocked, Neovim follows its environment: the rice
profile's palette as `:colorscheme rice` (re-applied when rice-theme pushes a
change for *this* profile), and the terminal's light/dark background.

| | |
|---|---|
| `:ThemeLock` | freeze the colours on screen into `colors/locked.lua`; rerun to refreeze |
| `:ThemeUnlock` | delete the freeze and follow the palette and terminal again, immediately |
| `vim.g.theme_lock = true` | in `init.lua`: lock from Lua (the freeze, else the default scheme) |
| `vim.g.theme_lock = '<name>'` | lock to that colorscheme; wins over a freeze |

While locked, palette pushes, terminal theme switches (Neovim 0.12 re-sets
`'background'` from the terminal even over init.lua's value) and the session's
environment don't change anything; `termguicolors` is forced so the terminal's
palette can't leak in. Switch schemes with `:colorscheme`, then `:ThemeLock`.

The freeze is shared by every rice profile (this directory is) and is
git-ignored; whitelist it in `.gitignore` to lock every machine. Other running
instances pick up a lock or unlock when they gain focus.

Cursor shape and colour per mode: `guicursor` in `options.lua`, colours in
`theme.lua` (Catppuccin Mocha hexes). Needs DECSCUSR + OSC-12 support
(kitty/ghostty/wezterm).

## Projects (per-project ShaDa)

Starting on a **directory** (`nvim .`, `nvim ~/src/app`) or bare (`nvim` inside
a project) gives that project its own ShaDa: marks, jumplist, registers and
`v:oldfiles` stop bleeding between repos. Starting on a file keeps the global
ShaDa. Subdirectories share the repo root's. `lua/config/project.lua`, no
plugin; it runs while init.lua is sourced because ShaDa is read after
(startup step 16).

Files are keyed by repo root in one store, so repos stay clean and the store
doubles as the recent-projects list (mtime = last visit):

```
~/.local/state/nvim/shada/projects/%home%carmack%src%app.shada
```

The default `'shada'` has `r/tmp/`, so files under `/tmp` never get marks.

## Git

`<leader>gg` opens lazygit in a floating terminal (`config.tui.float`, reusable
for any TUI). lazygit keeps `<Esc>` (the global `<Esc><Esc>` mapping is off in
that buffer); quit with `q`. On exit `:checktime` reloads buffers a checkout or
rebase changed. delta as lazygit's pager: `git.paging.pager: delta --dark
--paging=never` in `~/.config/lazygit/config.yml` (lazygit scrolls itself).
