# surround.nvim

Add, change and delete surrounding delimiter pairs. `ys`, `ds`, `cs`, `S` — the
vim-surround grammar, reimplemented in Lua around a different performance model.

```
ysiw(     foo        ->  ( foo )
ysiw)     foo        ->  (foo)
ds(       foo(bar)   ->  foobar
cs([      foo(bar)   ->  foo[ bar ]
cst<div>  <p>x</p>   ->  <div>x</div>
dsf       foo.bar(x) ->  x
```

## Install

### Vim packages (`:h packages`) — no plugin manager

Clone into a `start/` directory and it loads at startup. The middle path
component (`plugins` here) is just a grouping name; pick anything.

```bash
# Linux / macOS
git clone https://github.com/you/surround.nvim \
  ~/.config/nvim/pack/plugins/start/surround.nvim
```

```bash
# Windows (PowerShell)
git clone https://github.com/you/surround.nvim `
  $env:LOCALAPPDATA\nvim\pack\plugins\start\surround.nvim
```

That's the whole install — no `setup()` call needed. To configure, add to
`init.lua`:

```lua
require("surround").setup({ move_cursor = "sticky" })
```

`start/` packages join the runtimepath before `init.lua` runs, but their
`plugin/` scripts are sourced *after* it, so calling `setup()` from `init.lua`
is safe: it claims the load guard and the default keymaps are never applied
over yours.

**Lazy-loading:** put the clone under `opt/` instead of `start/` and load it on
demand:

```lua
vim.keymap.set("n", "ys", function()
  vim.cmd.packadd("surround.nvim")
  return "g@"
end, { expr = true })
```

**Updating:** `git -C ~/.config/nvim/pack/plugins/start/surround.nvim pull`. If
your config is itself a git repo, a submodule keeps the pin:

```bash
git submodule add https://github.com/you/surround.nvim \
  pack/plugins/start/surround.nvim
```

### What actually ships

Neovim only ever sources `plugin/` and resolves modules out of `lua/`.
`dev/`, `bench/` and `tests/` sit on no runtimepath directory, so cloning the
whole repo into `pack/*/start/` still loads nothing but the plugin — the
profiler is not merely unused, it is unreachable.

For a minimal tree anyway, `.gitattributes` marks those directories
`export-ignore`, so a release archive contains only `plugin/`, `lua/`, the
README and the licence:

```bash
git archive --format=tar.gz --prefix=surround.nvim/ -o surround.nvim.tar.gz HEAD
```

### Other managers

```lua
-- lazy.nvim
{ "you/surround.nvim", opts = {} }
```

Default keymaps are created at startup; nothing else under `lua/surround/` is
loaded until the first surround command is pressed. Set
`vim.g.surround_no_default_mappings = 1` to opt out.

## Keymaps

| Key | Action |
| --- | --- |
| `ys{motion}{char}` | surround the motion |
| `yss{char}` | surround the current line's text |
| `yS{motion}{char}` / `ySS{char}` | surround on separate lines, re-indented |
| `ds{char}` | delete the surrounding pair |
| `cs{old}{new}` | change the surrounding pair |
| `S{char}` (visual) | surround the selection |

`.` repeats all of them natively — no vim-repeat dependency.

**Delimiter chars.** `()[]{}` plus aliases `b B r`; `<>` is `a`. Quotes `" ' \``
and `q` for "whichever quote is innermost". `t` and `<` are tags (prompts for
one). `f` is a function call, `F` pads it. Anything else is used literally on
both sides, so `ysiw*` gives `*foo*`.

Opening chars pad, closing chars don't: `cs([` gives `[ x ]`, `cs(]` gives `[x]`.
`ds(` also strips one space of existing padding; `ds)` leaves it.

## Config

```lua
require("surround").setup({
  treesitter    = true,  -- use the tree when a parser is loaded
  scan_fallback = true,  -- still byte-scan if the tree finds nothing
  scan_radius   = 400,   -- lines each way before giving up; 0 = unbounded
  chunk         = 128,   -- lines fetched per buffer read
  escapes       = true,  -- honour backslash escapes when matching quotes
  quote_search_forward = true,
  keymaps = { normal = "ys", delete = "ds", change = "cs", visual = "S" },
})
```

Add your own delimiters. A surround is a record of operations keyed by
character, so `find` can be a spec or an arbitrary function:

```lua
require("surround").setup({
  surrounds = {
    ["e"] = { add = { "**", "**" }, find = { kind = "quote", open = "**" } },
    ["#"] = { add = { "#{", "}" },  find = { kind = "pair", open = "#{", close = "}" } },
    ["j"] = {
      add = { "<%= ", " %>" },
      -- packed, end-exclusive; see lua/surround/pos.lua
      find = function(buf, row, col) return o_s, o_e, c_s, c_e end,
    },
  },
})
```

## Profiling (development only)

**The shipped plugin contains no profiling code.** No hooks, no flags, no
counters, no `:Surround*` command — nothing in `lua/` or `plugin/` knows the
profiler exists. It lives in `dev/profile.lua`, off the runtimepath, and
reconstructs everything from the outside by patching module functions while it
is running and unpatching when it stops.

Load it only when you want it:

```vim
:lua dofile(vim.fn.expand("~/.config/nvim/pack/plugins/start/surround.nvim/dev/profile.lua"))
```

`:SurroundProfile` exists from that point on:

```vim
:SurroundProfile          " toggle
:SurroundProfile report   " print without stopping
:SurroundProfile reset
```

Or keep the handle and drive it from Lua:

```lua
local prof = dofile(".../dev/profile.lua")
prof.start()
-- ... do some editing ...
prof.stop()
print(prof.report())
```

Do some real editing between start and stop, then read the table:

```
stage                  calls      total      mean       p50       p95       max
------------------------------------------------------------------------------
resolve.find              31     1.84ms    59.4us      41.0     148.1     301.4
  ts.available            31     0.12ms     3.9us       3.1       7.2      11.0
  ts.pair                 28     0.91ms    32.5us      29.8      61.4      98.2
  scan.pair                3     0.42ms   140.1us     131.0     201.7     212.9
edit.replace_pair         31     0.21ms     6.8us       6.1      11.9      18.4

cache        8 hits / 39 queries (20.5%)
buffer       14 fetches, 1792 lines read
path         ts 28, scan 3
```

Timing comes from wrappers installed on module boundaries. The counters that
would otherwise need in-tree hooks are *derived* instead:

- **cache hits** — `resolve.find` returning without calling any sub-stage. The
  cache check returns before `line.reader` and `ts.available`, so "no
  sub-calls" is exactly "hit".
- **path** — which sub-stage returned non-nil.
- **buffer reads** — `nvim_buf_get_lines` is patched globally but only counted
  while inside a patched surround call, so unrelated editor traffic isn't
  attributed to the plugin.

That's the trade for keeping the plugin clean: these are exact for the current
control flow in `resolve.lua`, but they are assumptions *about* it rather than
assertions *from inside* it. If you restructure `find`'s early return, revisit
`dev/profile.lua`.

`prof.data()` returns the raw numbers if you want to serialise them.

## Benchmarks

Both scripts run against **your** files — point them at something large and
real, not a generated fixture.

Micro: the enclosing-pair query in isolation, sampled across 64 positions
spread through the file.

```bash
nvim -l bench/find.lua path/to/big.ts --iters 1000
```

Compares the treesitter path, the byte scanner, a cache hit, `searchpairpos()`,
and Vim's own `a(` motion.

End-to-end against other plugins — keystroke-to-buffer-change latency, the only
honest cross-plugin comparison since they all expose different internals:

```bash
nvim -l bench/compare.lua path/to/big.ts \
  --rtp ~/.local/share/nvim/lazy/nvim-surround \
  --rtp ~/.local/share/nvim/lazy/mini.nvim \
  --iters 300
```

Contenders not on the runtimepath are reported as skipped rather than silently
omitted. Buffer restore, cursor placement and keymap re-arming all happen
outside the timed region, and each contender reports how many iterations
*actually modified the buffer* — a plugin whose keystrokes no-op would
otherwise look like the winner.

The harness collects the GC before each run and stops it during, reporting
allocation per operation separately. A collection landing inside one iteration
is otherwise indistinguishable from that iteration being slow, which is the
single most common way Lua microbenchmarks lie. It reports p50/p95/max rather
than just a mean for the same reason.

---

## Why it's built this way

The design came out of VS Code's
[bracket pair colorization writeup](https://code.visualstudio.com/blogs/2021/09/29/bracket-pair-colorization),
which solves a closely related problem — "which pair encloses this position" —
at a scale where the naive answer took 10 seconds on a 42k-line file. Four of
its five ideas transfer directly. One does not, and that one matters most.

### Reuse the tree that already exists

The Bracket Pair Colorizer extension was slow largely because it had no access
to VS Code's tokens and had to rebuild bracket structure itself. Moving into
the core, where the token stream was already there, is what made it fast.

Neovim ships the same thing. Treesitter maintains an incrementally-updated
parse tree for the buffer whether or not this plugin exists. So the enclosing
pair is found by walking up ancestors from the node under the cursor —
`O(depth)`, typically under 25 hops, *independent of file size and of the
distance to the delimiter*. It also inherits the correctness property the
article calls out: a `(` inside a string or comment is a different node type,
so it never matches. No regex scanner gets that right without reimplementing
the lexer. See [`lua/surround/ts.lua`](lua/surround/ts.lua).

Most surround plugins call `searchpairpos()`, which is a Vimscript round trip
that scans backwards line by line and has no idea what a string literal is.

### Positions are packed scalars, not tables

The article packs a node's line/column length into a machine word. Lua numbers
are doubles, exact to 2^53, so `row * 2^24 + col` is free. The point isn't
arithmetic speed — it's that the scanner touches thousands of candidate
positions per query, and returning a `{row, col}` table from that loop is what
actually shows up in a profile. See [`lua/surround/pos.lua`](lua/surround/pos.lua).

### Apply edits in descending order

Every surround operation edits the buffer twice, and the first edit invalidates
the second's coordinates. The usual fixes are to re-find the pair or to
hand-compute column deltas — both break on multi-byte or multi-line delimiters.

The article's relative-length insight gives the clean answer: a position is only
stable with respect to what precedes it. Write the closing side first and the
opening coordinates were never disturbed, so there is nothing to remap and no
extmark bookkeeping to pay for. See [`lua/surround/edit.lua`](lua/surround/edit.lua).

### Bound the failure case

VS Code bounds its recursive descent with anchor sets so an unmatched bracket
can't drag the parser across the document. Same guarantee here, cruder
mechanism: `scan_radius` caps how far a scan walks, so a `ds(` with no
enclosing paren costs 400 lines of `string.find`, not the whole file. Buffer
lines are pulled in aligned 128-line windows rather than
`nvim_buf_get_lines(0, -1)` — fetching the whole buffer before looking at a
single character is the most common perf bug in this class of plugin.

### The one that doesn't transfer: incremental maintenance

VS Code keeps a persistent (2,3)-tree of bracket pairs and pays `O(log³ N)` on
**every edit**, buying `O(log² N + R)` queries. That is the right trade for
them: they re-colorize every visible bracket on every keystroke, so queries
vastly outnumber edits.

A surround plugin has the opposite access pattern. Queries are human-triggered
— a few per second at the absolute most — and edits are continuous. Porting the
incremental structure would mean running tree maintenance on every `on_bytes`
callback to accelerate an operation that happens when someone presses `ds(`. It
would be a strict, permanent loss.

So the caching is inverted: **nothing is maintained eagerly**. Results are
memoised against `b:changedtick` and discarded wholesale when the buffer
changes. Zero idle cost, `O(1)` invalidation, and because the cold query is
already fast the cache is a bonus rather than load-bearing. See
[`lua/surround/resolve.lua`](lua/surround/resolve.lua).

This is the actual lesson of the article, and it's easy to miss: the data
structure follows from the read/write ratio. Copying the structure without
checking the ratio gets you a slower plugin with more code.

### What was taken from nvim-surround

[kylechui/nvim-surround](https://github.com/kylechui/nvim-surround) makes a
different set of trade-offs — it locates pairs by feeding Vim motions
(`find = { motion = "a(" }`) and reading the marks back, with a cursor
save/restore per candidate. That is the cost this plugin is built to avoid, but
three of its ideas are straightforwardly better than what I had:

- **A surround is a record, not a branch.** `{ add, find, delete, change }`
  keyed by character, where `find` may be a spec *or a function*. It's why
  users can add `#{...}` without patching the plugin. Adopted, in reduced form:
  `setup({ surrounds = ... })` above.
- **`a(` as an oracle, not an implementation.** Delegating to Vim's motions is
  slow, but it is *authoritative* — `a(` is C code every Vim user's muscle
  memory is calibrated against. `tests/run.lua` now runs the byte scanner
  against `va(` at every column of a corpus of awkward lines and fails on any
  disagreement. Treesitter is off for that section on purpose: `a(` happily
  matches a paren inside a string, so only the scanner should agree with it
  character for character.
- **Cursor policy.** `move_cursor = "begin" | "sticky" | false`. "sticky" is
  the one place in this plugin where an extmark earns its keep — the delimiter
  coordinates stay valid by construction, but the character the user was
  sitting on genuinely does move, and only the buffer knows where to.

Its UTF-8 first-byte helper was worth copying too: a cursor parked on a
continuation byte makes every downstream column wrong.

Not adopted: routing every candidate through `nvim_feedkeys` with
`winsaveview`/`winrestview` around it (the thing being optimised away here),
and Lua-pattern delete specs like `"^(.)().-(.)()$"`, which re-parse text the
find step has already located.

## Tests and benchmarks

```bash
nvim -l tests/run.lua
```

See [Benchmarks](#benchmarks) above for `bench/find.lua` and
`bench/compare.lua`, both of which take your own files as input.
