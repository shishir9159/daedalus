--- Shared benchmarking harness.
---
--- Usage from a bench script:
---   local H = dofile("bench/harness.lua")
---   H.add("name", fn, { setup = ..., teardown = ... })
---   H.run()
local root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h")
vim.opt.runtimepath:prepend(root)
package.path = root .. "/lua/?.lua;" .. root .. "/lua/?/init.lua;" .. package.path

-- The profiler is a dev tool living outside `lua/`, so it is loaded by path
-- rather than `require`d. See dev/profile.lua.
local profile = dofile(root .. "/dev/profile.lua")

local H = { root = root, contenders = {}, profile = profile }

-----------------------------------------------------------------------------
-- Argument parsing
-----------------------------------------------------------------------------

--- Parse `nvim -l bench/x.lua FILE [--rtp DIR] [--iters N] [--ops ds,cs]`.
function H.args()
  local a = { files = {}, rtp = {}, iters = 500, ops = { "ds", "cs", "ys" }, char = "(" }
  local argv = _G.arg or {}
  local i = 1
  while i <= #argv do
    local v = argv[i]
    if v == "--rtp" then
      i = i + 1
      a.rtp[#a.rtp + 1] = argv[i]
    elseif v == "--iters" then
      i = i + 1
      a.iters = tonumber(argv[i]) or a.iters
    elseif v == "--char" then
      i = i + 1
      a.char = argv[i]
    elseif v == "--ops" then
      i = i + 1
      a.ops = vim.split(argv[i], ",", { plain = true })
    elseif v:sub(1, 2) == "--" then
      error("unknown flag: " .. v)
    else
      a.files[#a.files + 1] = v
    end
    i = i + 1
  end
  for _, d in ipairs(a.rtp) do
    vim.opt.runtimepath:append(vim.fn.fnamemodify(d, ":p"))
  end
  return a
end

-----------------------------------------------------------------------------
-- Buffer fixtures
-----------------------------------------------------------------------------

--- Load a real file into a scratch buffer with its detected filetype, so
--- treesitter-backed contenders get a parser.
function H.load(path)
  local lines = vim.fn.readfile(path)
  local b = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.api.nvim_win_set_buf(0, b)

  local ft = vim.filetype.match({ filename = path, buf = b }) or ""
  vim.bo[b].filetype = ft
  if ft ~= "" then
    pcall(function()
      vim.treesitter.get_parser(b):parse()
    end)
  end
  return b, lines, ft
end

--- Pick `n` cursor positions spread through the buffer that sit *inside* a
--- pair of `open`/`close` on one line. Measuring at a single position tells
--- you about that position, not about the file.
function H.sites(buf, open, close, n)
  local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
  local found = {}
  for row = 1, #lines do
    local l = lines[row]
    local o = l:find(open, 1, true)
    if o then
      local c = l:find(close, o + 1, true)
      if c and c > o + 1 then
        found[#found + 1] = { row - 1, o } -- 0-indexed row, col just inside
      end
    end
  end
  if #found == 0 then
    return {}
  end
  local out, step = {}, math.max(1, math.floor(#found / n))
  for i = 1, #found, step do
    out[#out + 1] = found[i]
    if #out >= n then
      break
    end
  end
  return out
end

-----------------------------------------------------------------------------
-- Contenders
-----------------------------------------------------------------------------

---@param name string
---@param fn fun()
---@param opts? table passed through to profile.measure
function H.add(name, fn, opts)
  H.contenders[#H.contenders + 1] = { name = name, fn = fn, opts = opts or {} }
end

function H.skip(name, why)
  H.contenders[#H.contenders + 1] = { name = name, skipped = why }
end

local function fmt_ns(ns)
  if ns >= 1e6 then
    return ("%.2fms"):format(ns / 1e6)
  end
  return ("%.1fus"):format(ns / 1e3)
end

--- Run every contender and print a comparison table, ranked, with the
--- fastest as the baseline for the relative column.
function H.run(title, iters)
  print("")
  print(title)
  print(string.rep("=", 82))
  print(("%-26s %10s %10s %10s %10s %10s"):format("", "mean", "p50", "p95", "max", "alloc/op"))
  print(string.rep("-", 82))

  local results = {}
  for _, c in ipairs(H.contenders) do
    if c.skipped then
      print(("%-26s %s"):format(c.name, "-- " .. c.skipped))
    else
      local ok, r = pcall(profile.measure, c.fn, vim.tbl_extend("keep", c.opts, { iters = iters }))
      if not ok then
        print(("%-26s %s"):format(c.name, "-- error: " .. tostring(r):sub(1, 44)))
      else
        r.name = c.name
        results[#results + 1] = r
        print(("%-26s %10s %10s %10s %10s %9.2fKB"):format(
          c.name, fmt_ns(r.mean_ns), fmt_ns(r.p50_ns), fmt_ns(r.p95_ns),
          fmt_ns(r.max_ns), r.alloc_kb_per_op
        ))
      end
    end
  end

  if #results > 1 then
    table.sort(results, function(a, b)
      return a.p50_ns < b.p50_ns
    end)
    local base = results[1].p50_ns
    print(string.rep("-", 82))
    print("relative (p50, lower is better):")
    for _, r in ipairs(results) do
      print(("  %-26s %6.1fx   %s"):format(r.name, r.p50_ns / base, fmt_ns(r.p50_ns)))
    end
  end

  H.contenders = {}
  return results
end

return H
