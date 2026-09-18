--- Development-only profiler. NOT part of the plugin.
---
--- This file lives outside `lua/`, so Neovim never puts it on the module path
--- and `plugin/surround.lua` never touches it. The shipped plugin contains no
--- profiling code at all -- no hooks, no flags, no counters, no `:Surround*`
--- command. Everything below is reconstructed from the outside by patching
--- module functions while profiling is on, and unpatching when it stops.
---
--- Load it explicitly when you want it:
---
---   :lua dofile("/path/to/surround.nvim/dev/profile.lua")
---   " :SurroundProfile now exists
---
--- or from Lua, keeping the handle:
---
---   local prof = dofile(".../dev/profile.lua")
---   prof.start(); ...; print(prof.report())
---
--- Caveat inherent to this approach: counters are derived, not observed. A
--- cache hit is inferred from `resolve.find` completing without calling any
--- sub-stage, and the answering path from which sub-stage returned non-nil.
--- Both are exact for the current control flow in resolve.lua, but they are
--- assumptions about it rather than assertions from inside it.
local M = {}

local hrtime = (vim.uv or vim.loop).hrtime

M.enabled = false

local stats = {}
local counters = {}
local patched = {}

--- Nesting depth of patched surround calls. Used to attribute buffer reads:
--- `nvim_buf_get_lines` is patched globally, but only counted while we are
--- inside a surround operation.
local depth = 0

--- Per-`resolve.find` scratch, used to derive cache hits and answering path.
local current = nil

local MAX_SAMPLES = 20000

local function stat(label)
  local s = stats[label]
  if not s then
    s = { calls = 0, total = 0, min = math.huge, max = 0, samples = {}, n = 0 }
    stats[label] = s
  end
  return s
end

function M.record(label, ns)
  local s = stat(label)
  s.calls = s.calls + 1
  s.total = s.total + ns
  if ns < s.min then
    s.min = ns
  end
  if ns > s.max then
    s.max = ns
  end
  if s.n < MAX_SAMPLES then
    s.n = s.n + 1
    s.samples[s.n] = ns
  end
end

function M.count(label, n)
  counters[label] = (counters[label] or 0) + (n or 1)
end

-----------------------------------------------------------------------------
-- Instrumentation
-----------------------------------------------------------------------------

local function unpatch_all()
  for i = #patched, 1, -1 do
    local p = patched[i]
    p.tbl[p.name] = p.orig
  end
  patched = {}
end

local function remember(tbl, name)
  patched[#patched + 1] = { tbl = tbl, name = name, orig = tbl[name] }
  return tbl[name]
end

--- Time a stage. `path`: the label to attribute to `resolve.find` if this call
--- answered it.
local function patch(modname, name, label, path)
  local mod = require(modname)
  if type(mod[name]) ~= "function" then
    return
  end
  local orig = remember(mod, name)
  mod[name] = function(...)
    if current then
      current.subcalls = current.subcalls + 1
    end
    depth = depth + 1
    local t0 = hrtime()
    local a, b, c, d = orig(...)
    M.record(label, hrtime() - t0)
    depth = depth - 1
    if path and a ~= nil and current then
      current.path = path
    end
    return a, b, c, d
  end
end


local function patch_find()
  local resolve = require("surround.resolve")
  local orig = remember(resolve, "find")
  resolve.find = function(...)
    local prev = current
    current = { subcalls = 0, path = "none" }
    depth = depth + 1

    local t0 = hrtime()
    local r = orig(...)
    M.record("resolve.find", hrtime() - t0)

    depth = depth - 1
    -- The cache check returns before any sub-stage runs, so "no sub-calls"
    -- is exactly "cache hit".
    M.count(current.subcalls == 0 and "cache hits" or "cache misses")
    M.count("path: " .. current.path)
    current = prev
    return r
  end
end

local function patch_buffer_reads()
  local orig = remember(vim.api, "nvim_buf_get_lines")
  vim.api.nvim_buf_get_lines = function(b, lo, hi, strict)
    local r = orig(b, lo, hi, strict)
    if depth > 0 then
      M.count("buffer fetches")
      M.count("lines read", #r)
    end
    return r
  end
end

function M.start()
  if M.enabled then
    return
  end
  M.enabled = true
  depth, current = 0, nil

  patch_find()

  patch("surround.ts", "available", "  ts.available", nil)
  patch("surround.ts", "pair", "  ts.pair", "ts")
  patch("surround.ts", "tag", "  ts.tag", "ts")
  patch("surround.scan", "pair", "  scan.pair", "scan")
  patch("surround.scan", "quote", "  scan.quote", "scan")
  patch("surround.scan", "tag", "  scan.tag", "scan")

  patch("surround.edit", "replace_pair", "edit.replace_pair")
  patch("surround.edit", "wrap", "edit.wrap")
  patch("surround.edit", "wrap_lines", "edit.wrap_lines")

  patch_buffer_reads()
end

function M.stop()
  if not M.enabled then
    return
  end
  M.enabled = false
  unpatch_all()
  -- An error thrown through a wrapper skips its decrement; reset rather than
  -- paying for a pcall inside the region being timed.
  depth, current = 0, nil
end

function M.reset()
  stats = {}
  counters = {}
end

-----------------------------------------------------------------------------
-- Reporting
-----------------------------------------------------------------------------

local function percentile(sorted, n, p)
  if n == 0 then
    return 0
  end
  local i = math.ceil(p * n)
  if i < 1 then
    i = 1
  end
  if i > n then
    i = n
  end
  return sorted[i]
end

local function us(ns)
  return ns / 1000
end

local ORDER = {
  "resolve.find",
  "  ts.available",
  "  ts.pair",
  "  ts.tag",
  "  scan.pair",
  "  scan.quote",
  "  scan.tag",
  "edit.replace_pair",
  "edit.wrap",
  "edit.wrap_lines",
}

---@return string
function M.report()
  local out = {}
  local seen = {}

  out[#out + 1] = ("%-20s %7s %10s %9s %9s %9s %9s"):format(
    "stage", "calls", "total", "mean", "p50", "p95", "max"
  )
  out[#out + 1] = string.rep("-", 78)

  local any = false
  local function row(label, s)
    -- Copied with a loop, not unpack(): LuaJIT's unpack blows the C stack
    -- somewhere around 8k values and MAX_SAMPLES is well past that.
    local sorted = {}
    for i = 1, s.n do
      sorted[i] = s.samples[i]
    end
    table.sort(sorted)
    out[#out + 1] = ("%-20s %7d %9.2fms %8.1fus %8.1f %8.1f %8.1f"):format(
      label,
      s.calls,
      s.total / 1e6,
      us(s.total / s.calls),
      us(percentile(sorted, s.n, 0.50)),
      us(percentile(sorted, s.n, 0.95)),
      us(s.max)
    )
  end

  for _, label in ipairs(ORDER) do
    seen[label] = true
    local s = stats[label]
    if s and s.calls > 0 then
      any = true
      row(label, s)
    end
  end
  for label, s in pairs(stats) do
    if not seen[label] and s.calls > 0 then
      any = true
      row(label, s)
    end
  end

  if not any then
    return "surround: no samples recorded (is profiling started?)"
  end

  local hits = counters["cache hits"] or 0
  local misses = counters["cache misses"] or 0
  if hits + misses > 0 then
    out[#out + 1] = ""
    out[#out + 1] = ("cache        %d hits / %d queries (%.1f%%)"):format(
      hits, hits + misses, hits / (hits + misses) * 100
    )
  end

  local fetches = counters["buffer fetches"] or 0
  if fetches > 0 then
    out[#out + 1] = ("buffer       %d fetches, %d lines read"):format(
      fetches, counters["lines read"] or 0
    )
  end

  local paths = {}
  for _, p in ipairs({ "ts", "scan", "none" }) do
    local n = counters["path: " .. p]
    if n then
      paths[#paths + 1] = ("%s %d"):format(p, n)
    end
  end
  if #paths > 0 then
    out[#out + 1] = ("path         %s"):format(table.concat(paths, ", "))
  end

  return table.concat(out, "\n")
end

-----------------------------------------------------------------------------
-- Ad-hoc measurement, used by the bench harness
-----------------------------------------------------------------------------

--- Time `fn` with warmup, GC control and percentiles.
---
--- GC is collected before the run and stopped during it, because a collection
--- landing inside one iteration is otherwise indistinguishable from that
--- iteration being slow -- the most common way Lua microbenchmarks lie.
--- Allocation is reported separately instead.
---@param fn fun()
--- `teardown` gets `true` on timed iterations and `false` on warmup ones, so
--- a caller counting outcomes can leave the warmup out.
---@param opts? { iters?: integer, warmup?: integer, setup?: fun(), teardown?: fun(timed: boolean) }
function M.measure(fn, opts)
  opts = opts or {}
  local iters = opts.iters or 1000
  local warmup = opts.warmup or math.max(10, math.floor(iters / 20))

  for _ = 1, warmup do
    if opts.setup then
      opts.setup()
    end
    fn()
    if opts.teardown then
      opts.teardown(false)
    end
  end

  collectgarbage("collect")
  collectgarbage("stop")
  local kb0 = collectgarbage("count")

  local samples = {}
  for i = 1, iters do
    if opts.setup then
      opts.setup()
    end
    local t0 = hrtime()
    fn()
    samples[i] = hrtime() - t0
    if opts.teardown then
      opts.teardown(true)
    end
  end

  local kb1 = collectgarbage("count")
  collectgarbage("restart")

  local total = 0
  for i = 1, iters do
    total = total + samples[i]
  end
  table.sort(samples)

  return {
    iters = iters,
    mean_ns = total / iters,
    p50_ns = percentile(samples, iters, 0.50),
    p95_ns = percentile(samples, iters, 0.95),
    p99_ns = percentile(samples, iters, 0.99),
    min_ns = samples[1],
    max_ns = samples[iters],
    alloc_kb_per_op = (kb1 - kb0) / iters,
  }
end

-----------------------------------------------------------------------------
-- :SurroundProfile, registered only because you loaded this file
-----------------------------------------------------------------------------

vim.api.nvim_create_user_command("SurroundProfile", function(a)
  local action = a.args ~= "" and a.args or (M.enabled and "stop" or "start")
  if action == "start" then
    M.reset()
    M.start()
    vim.notify("surround: profiling started")
  elseif action == "stop" then
    M.stop()
    vim.notify("surround: profiling stopped\n\n" .. M.report())
  elseif action == "report" then
    vim.notify(M.report())
  elseif action == "reset" then
    M.reset()
    vim.notify("surround: profile reset")
  else
    vim.notify("surround: unknown action " .. action, vim.log.levels.ERROR)
  end
end, {
  nargs = "?",
  force = true,
  complete = function()
    return { "start", "stop", "report", "reset" }
  end,
  desc = "Toggle or report surround profiling (dev tool)",
})

return M
