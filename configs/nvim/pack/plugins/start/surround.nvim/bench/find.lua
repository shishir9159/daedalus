--- Micro-benchmark: "which pair encloses the cursor?"
---
---   nvim -l bench/find.lua BIGFILE.lua [--iters 1000] [--char "("]
---
--- Measures the query in isolation, across positions spread through the whole
--- file rather than one hand-picked spot -- a single site tells you about that
--- site, not about the file.
local here = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h")
local H = dofile(here .. "/harness.lua")

local resolve = require("surround.resolve")
local config = require("surround.config")

local a = H.args()
if #a.files == 0 then
  print("usage: nvim -l bench/find.lua FILE [--iters N] [--char '(']")
  os.exit(1)
end

local PAIRS = { ["("] = ")", ["{"] = "}", ["["] = "]" }
local open = a.char
local close = PAIRS[open] or open

for _, path in ipairs(a.files) do
  local buf, lines, ft = H.load(path)
  local sites = H.sites(buf, open, close, 64)

  print(("\n%s  --  %d lines, filetype %q, %d probe sites"):format(
    path, #lines, ft ~= "" and ft or "none", #sites
  ))
  if #sites == 0 then
    print("  no `" .. open .. "` ... `" .. close .. "` pairs on any single line; skipping")
  else
    -- Round-robin through the probe sites so every measurement samples a
    -- different depth and a different distance to the delimiter.
    local i = 0
    local row, col = sites[1][1], sites[1][2]
    local function next_site()
      i = i % #sites + 1
      row, col = sites[i][1], sites[i][2]
    end

    local has_ts = ft ~= "" and pcall(vim.treesitter.get_parser, buf)

    if has_ts then
      H.add("surround (treesitter)", function()
        return resolve.find(buf, row, col, open)
      end, {
        setup = function()
          next_site()
          config.opts.treesitter = true
          resolve.invalidate(buf)
        end,
      })
    else
      H.skip("surround (treesitter)", "no parser for filetype " .. (ft ~= "" and ft or "?"))
    end

    H.add("surround (scan)", function()
      return resolve.find(buf, row, col, open)
    end, {
      setup = function()
        next_site()
        config.opts.treesitter = false
        resolve.invalidate(buf)
      end,
    })

    H.add("surround (cache hit)", function()
      return resolve.find(buf, row, col, open)
    end, {
      setup = function()
        config.opts.treesitter = has_ts
      end,
    })

    -- The builtin most surround plugins reach for.
    H.add("searchpairpos()", function()
      vim.fn.cursor(row + 1, col + 1)
      local o = vim.fn.searchpairpos("\\V" .. open, "", "\\V" .. close, "bnW")
      local c = vim.fn.searchpairpos("\\V" .. open, "", "\\V" .. close, "nW")
      return o, c
    end, { setup = next_site })

    -- nvim-surround's strategy: delegate to Vim's own `a(` text object and
    -- read the marks back. C-speed matching, but it pays a full normal-mode
    -- command dispatch plus cursor save/restore per query.
    local ESC = vim.api.nvim_replace_termcodes("<Esc>", true, false, true)
    local motion = "va" .. open .. ESC
    H.add("vim `a" .. open .. "` motion", function()
      local view = vim.fn.winsaveview()
      vim.fn.cursor(row + 1, col + 1)
      pcall(vim.cmd.normal, { motion, bang = true })
      local s, e = vim.fn.getpos("'<"), vim.fn.getpos("'>")
      vim.fn.winrestview(view)
      return s, e
    end, { setup = next_site })

    H.run(("find enclosing %s%s  (%d iterations)"):format(open, close, a.iters), a.iters)

    config.opts.treesitter = true
  end
end

print("\nnote: `cache hit` is the same query repeated without an intervening")
print("buffer change. Real editing invalidates on every changedtick, so treat")
print("it as the floor, not the expected case.")
