--- Applying the edit.
---
--- Every surround operation touches the buffer twice (open side and close
--- side), and the first edit shifts the coordinates of the second. The usual
--- workarounds are to re-find the pair after edit one, or to recompute column
--- deltas by hand -- both are bugs waiting to happen with multi-byte or
--- multi-line delimiters.
---
--- The article's relative-length insight gives the clean answer: a position is
--- only stable relative to what precedes it. Apply the edits in descending
--- buffer order and the earlier coordinates are never invalidated at all, so
--- no remapping is needed and no extmark bookkeeping is paid for.
local api = vim.api
local pos = require("surround.pos")

local M = {}

local function split(s)
  if s == "" then
    return { "" }
  end
  if not s:find("\n", 1, true) then
    return { s }
  end
  return vim.split(s, "\n", { plain = true })
end

--- Replace the two delimiter regions of an existing pair.
---@param region integer[] {o_start, o_end, c_start, c_end} packed, end-exclusive
---@return integer row, integer col cursor target (start of the open region)
function M.replace_pair(buf, region, left, right)
  local csr, csc = pos.unpack(region[3])
  local cer, cec = pos.unpack(region[4])
  local osr, osc = pos.unpack(region[1])
  local oer, oec = pos.unpack(region[2])

  -- Close side first: it is strictly after the open side, so this leaves the
  -- open coordinates valid.
  api.nvim_buf_set_text(buf, csr, csc, cer, cec, split(right))
  api.nvim_buf_set_text(buf, osr, osc, oer, oec, split(left))
  return osr, osc
end

--- Wrap the charwise range [sr,sc)..(er,ec) with `left` and `right`.
---@return integer row, integer col cursor target
function M.wrap(buf, sr, sc, er, ec, left, right)
  api.nvim_buf_set_text(buf, er, ec, er, ec, split(right))
  api.nvim_buf_set_text(buf, sr, sc, sr, sc, split(left))
  return sr, sc
end

--- Wrap lines [sr..er] with `left` and `right` on their own lines, matching
--- the indent of the first line and shifting the body one `shiftwidth`.
function M.wrap_lines(buf, sr, er, left, right)
  local first = api.nvim_buf_get_lines(buf, sr, sr + 1, false)[1] or ""
  local indent = first:match("^%s*") or ""

  local sw = vim.bo[buf].shiftwidth
  if sw == 0 then
    sw = vim.bo[buf].tabstop
  end
  local body_indent = vim.bo[buf].expandtab and string.rep(" ", sw) or "\t"

  local body = api.nvim_buf_get_lines(buf, sr, er + 1, false)
  for i = 1, #body do
    if body[i] ~= "" then
      body[i] = body_indent .. body[i]
    end
  end

  local out = { indent .. left }
  for i = 1, #body do
    out[#out + 1] = body[i]
  end
  out[#out + 1] = indent .. right

  api.nvim_buf_set_lines(buf, sr, er + 1, false, out)
  return sr, #indent
end

function M.set_cursor(row, col)
  local last = api.nvim_buf_line_count(0)
  if row + 1 > last then
    row = last - 1
  end
  local len = #(api.nvim_buf_get_lines(0, row, row + 1, false)[1] or "")
  if col > len then
    col = len
  end
  pcall(api.nvim_win_set_cursor, 0, { row + 1, col })
end

return M
