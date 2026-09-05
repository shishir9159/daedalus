--- End-to-end comparison against other surround plugins.
---
---   nvim -l bench/compare.lua BIGFILE.lua \
---     --rtp ~/.local/share/nvim/lazy/nvim-surround \
---     --rtp ~/.local/share/nvim/lazy/mini.nvim \
---     --rtp ~/.vim/bundle/vim-surround \
---     --iters 300
---
--- Measures keystroke-to-buffer-change latency, which is the only honest
--- cross-plugin comparison: every plugin exposes a different internal API, but
--- they all have to turn `ds)` into an edit. Buffer restore and cursor
--- placement happen in `setup`, outside the timed region.
local here = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h")
local H = dofile(here .. "/harness.lua")

local a = H.args()
if #a.files == 0 then
  print("usage: nvim -l bench/compare.lua FILE [--rtp DIR]... [--iters N]")
  os.exit(1)
end

-- Source anything the --rtp dirs registered; `nvim -l` will not have.
if #a.rtp > 0 then
  pcall(vim.cmd, "runtime! plugin/**/*.vim")
  pcall(vim.cmd, "runtime! plugin/**/*.lua")
end

-----------------------------------------------------------------------------
-- Contenders
-----------------------------------------------------------------------------

--- Each entry declares how to (re)install its keymaps and what to press.
--- They share `ds`/`cs` lhs, so exactly one can be armed at a time and every
--- contender must reinstall before its run.
local PLUGINS = {
  {
    name = "surround.nvim (this)",
    detect = function()
      return true
    end,
    arm = function()
      require("surround").setup({})
    end,
    keys = { ds = "ds)", cs = "cs)]", ys = "ysiw)" },
  },
  {
    name = "nvim-surround",
    detect = function()
      return pcall(require, "nvim-surround")
    end,
    arm = function()
      require("nvim-surround").setup({})
    end,
    keys = { ds = "ds)", cs = "cs)]", ys = "ysiw)" },
  },
  {
    name = "mini.surround",
    detect = function()
      return pcall(require, "mini.surround")
    end,
    arm = function()
      require("mini.surround").setup({})
    end,
    -- mini uses its own grammar: sd/sr, and `sa` takes the motion first.
    keys = { ds = "sd)", cs = "sr)]", ys = "saiw)" },
  },
  {
    name = "vim-surround",
    detect = function()
      return vim.fn.exists("*surround#Opfunc") == 1
    end,
    arm = function()
      pcall(vim.cmd, "runtime plugin/surround.vim")
    end,
    keys = { ds = "ds)", cs = "cs)]", ys = "ysiw)" },
  },
}

local OP_LABEL = {
  ds = "delete surrounding parens",
  cs = "change () to []",
  ys = "surround inner word",
}

-----------------------------------------------------------------------------

for _, path in ipairs(a.files) do
  local buf, lines, ft = H.load(path)
  local sites = H.sites(buf, "(", ")", 64)

  print(("\n%s  --  %d lines, filetype %q, %d probe sites"):format(
    path, #lines, ft ~= "" and ft or "none", #sites
  ))

  if #sites == 0 then
    print("  no single-line `(...)` pairs found; skipping")
  else
    -- Original text of every probe line, so `setup` can restore cheaply
    -- instead of rewriting the whole buffer between iterations.
    local orig = {}
    for _, s in ipairs(sites) do
      orig[s[1]] = vim.api.nvim_buf_get_lines(buf, s[1], s[1] + 1, false)[1]
    end

    for _, op in ipairs(a.ops) do
      local i = 0
      local row, col = sites[1][1], sites[1][2]
      local changed = {}

      for _, p in ipairs(PLUGINS) do
        local keys = p.keys[op]
        if not keys then
          H.skip(p.name, "no mapping for " .. op)
        elseif not p.detect() then
          H.skip(p.name, "not installed")
        else
          local pname = p.name
          local termkeys = vim.api.nvim_replace_termcodes(keys, true, false, true)

          H.add(pname, function()
            vim.api.nvim_feedkeys(termkeys, "mtx", false)
            vim.api.nvim_feedkeys("", "x", false)
          end, {
            setup = function()
              i = i % #sites + 1
              row, col = sites[i][1], sites[i][2]
              vim.api.nvim_buf_set_lines(buf, row, row + 1, false, { orig[row] })
              vim.api.nvim_win_set_cursor(0, { row + 1, col })
              p.arm()
            end,
            teardown = function()
              local now = vim.api.nvim_buf_get_lines(buf, row, row + 1, false)[1]
              if now ~= orig[row] then
                changed[pname] = (changed[pname] or 0) + 1
              end
            end,
          })
        end
      end

      local results = H.run(
        ("%s  --  `%s`  (%d iterations)"):format(OP_LABEL[op] or op, op, a.iters),
        a.iters
      )

      -- A plugin whose keystrokes silently do nothing would otherwise look
      -- fastest. Report the hit rate so a zero is impossible to miss.
      if #results > 0 then
        print("effective (iterations that actually modified the line):")
        for _, r in ipairs(results) do
          local n = changed[r.name] or 0
          print(("  %-26s %d/%d%s"):format(
            r.name, n, a.iters, n == 0 and "   <-- NO-OP, timing is meaningless" or ""
          ))
        end
      end
    end
  end
end

print("\nnote: restoring the line, moving the cursor and re-arming keymaps all")
print("happen outside the timed region. What is measured is feedkeys dispatch")
print("through the plugin's mapping to the completed buffer edit.")
