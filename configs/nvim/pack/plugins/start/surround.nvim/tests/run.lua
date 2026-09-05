-- Run with:  nvim -l tests/run.lua
local root = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h")
vim.opt.runtimepath:prepend(root)
package.path = root .. "/lua/?.lua;" .. root .. "/lua/?/init.lua;" .. package.path

local surround = require("surround")
local resolve = require("surround.resolve")
local config = require("surround.config")
local pos = require("surround.pos")
local edit = require("surround.edit")

-- Exercise the scanner deterministically; treesitter gets its own section.
config.opts.treesitter = false

local passed, failed = 0, 0

local function ok(name, cond, got)
  if cond then
    passed = passed + 1
  else
    failed = failed + 1
    io.write(("FAIL  %s%s\n"):format(name, got and ("  -> got: " .. vim.inspect(got)) or ""))
  end
end

local function eq(name, a, b)
  ok(name, vim.deep_equal(a, b), a)
end

local function mkbuf(lines, row, col)
  local b = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.api.nvim_win_set_buf(0, b)
  vim.api.nvim_win_set_cursor(0, { row + 1, col })
  return b
end

--- Find and render the located regions as {orow, ocol, crow, ccol}.
local function locate(lines, row, col, char)
  local b = mkbuf(lines, row, col)
  local r = resolve.find(b, row, col, char)
  if not r then
    return nil
  end
  local osr, osc = pos.unpack(r[1])
  local csr, csc = pos.unpack(r[3])
  return { osr, osc, csr, csc }
end

local function do_op(lines, row, col, fn)
  local b = mkbuf(lines, row, col)
  fn(b, row, col)
  return vim.api.nvim_buf_get_lines(b, 0, -1, false)
end

-----------------------------------------------------------------------------
print("-- pos --")
-----------------------------------------------------------------------------
do
  local p = pos.pack(1234, 56)
  local r, c = pos.unpack(p)
  ok("pack/unpack round trip", r == 1234 and c == 56, { r, c })
  ok("row ordering", pos.pack(2, 0) > pos.pack(1, 999999))
end

-----------------------------------------------------------------------------
print("-- scanner: pairs --")
-----------------------------------------------------------------------------
eq("cursor inside", locate({ "foo(bar)" }, 0, 5, "("), { 0, 3, 0, 7 })
eq("cursor on opener", locate({ "foo(bar)" }, 0, 3, "("), { 0, 3, 0, 7 })
eq("cursor on closer", locate({ "foo(bar)" }, 0, 7, "("), { 0, 3, 0, 7 })
eq("nested, cursor inside inner", locate({ "((a))" }, 0, 2, "("), { 0, 1, 0, 3 })
eq("nested, cursor on inner opener", locate({ "((a))" }, 0, 1, "("), { 0, 1, 0, 3 })
eq("nested, cursor on outer opener", locate({ "((a))" }, 0, 0, "("), { 0, 0, 0, 4 })
eq("closer at column 0", locate({ "(a", ") b" }, 1, 0, "("), { 0, 0, 1, 0 })
eq("multiline", locate({ "f(", "  x", ")" }, 1, 2, "("), { 0, 1, 2, 0 })
eq("skips balanced siblings", locate({ "((a) (b) c)" }, 0, 9, "("), { 0, 0, 0, 10 })
eq("braces", locate({ "x { y } z" }, 0, 5, "{" ), { 0, 2, 0, 6 })
eq("alias b", locate({ "foo(bar)" }, 0, 5, "b"), { 0, 3, 0, 7 })
ok("unmatched returns nil", locate({ "no parens here" }, 0, 3, "(") == nil)

do
  local save = config.opts.pair_search_forward
  config.opts.pair_search_forward = true
  eq("forward: next pair", locate({ "foo(bar)" }, 0, 0, "("), { 0, 3, 0, 7 })
  eq("forward: crosses lines", locate({ "foo", "(bar)" }, 0, 1, "("), { 1, 0, 1, 4 })
  ok("forward: a stray closer cancels it", locate({ "x )(y)" }, 0, 0, "(") == nil)
  config.opts.pair_search_forward = false
  ok("forward off: enclosing only", locate({ "foo(bar)" }, 0, 0, "(") == nil)
  config.opts.pair_search_forward = save
end

-----------------------------------------------------------------------------
print("-- scanner: bounded radius --")
-----------------------------------------------------------------------------
do
  local lines = { "(" }
  for _ = 1, 50 do
    lines[#lines + 1] = "filler"
  end
  lines[#lines + 1] = ")"
  local save = config.opts.scan_radius
  config.opts.scan_radius = 5
  ok("radius stops the walk", locate(lines, 25, 0, "(") == nil)
  config.opts.scan_radius = 0
  eq("radius 0 is unbounded", locate(lines, 25, 0, "("), { 0, 0, 51, 0 })
  config.opts.scan_radius = save
end

-----------------------------------------------------------------------------
print("-- scanner: quotes --")
-----------------------------------------------------------------------------
eq("inside quotes", locate({ [[a "b" c]] }, 0, 4, '"'), { 0, 2, 0, 4 })
eq("pairs off from line start", locate({ [["a", "b"]] }, 0, 6, '"'), { 0, 5, 0, 7 })
eq("cursor on opening quote", locate({ [[a "b" c]] }, 0, 2, '"'), { 0, 2, 0, 4 })
eq("search forward on line", locate({ [[a "b" c]] }, 0, 0, '"'), { 0, 2, 0, 4 })
eq("escaped quote ignored", locate({ [[x "a\"b" y]] }, 0, 4, '"'), { 0, 2, 0, 7 })
eq("q alias picks innermost", locate({ [[a '"x"' b]] }, 0, 4, "q"), { 0, 3, 0, 5 })
ok("single quote is not a pair", locate({ "just one \" here" }, 0, 2, '"') == nil)

-----------------------------------------------------------------------------
print("-- scanner: tags --")
-----------------------------------------------------------------------------
eq("innermost element", locate({ "<div><p>x</p></div>" }, 0, 8, "t"), { 0, 5, 0, 9 })
eq("cursor on opening tag", locate({ "<div><p>x</p></div>" }, 0, 6, "t"), { 0, 5, 0, 9 })
eq("cursor on closing tag", locate({ "<div><p>x</p></div>" }, 0, 10, "t"), { 0, 5, 0, 9 })
eq("void tag does not affect depth", locate({ "<div>a<br>b</div>" }, 0, 6, "t"), { 0, 0, 0, 11 })
eq("self-closing ignored", locate({ "<div><img src=x/>y</div>" }, 0, 17, "t"), { 0, 0, 0, 18 })
eq("multiline element", locate({ "<ul>", "  <li>x</li>", "</ul>" }, 1, 8, "t"), { 1, 2, 1, 7 })

-----------------------------------------------------------------------------
print("-- scanner: function calls --")
-----------------------------------------------------------------------------
eq("callee included", locate({ "foo.bar(x)" }, 0, 8, "f"), { 0, 0, 0, 9 })
eq("bare call", locate({ "  baz(x)" }, 0, 6, "f"), { 0, 2, 0, 7 })

-----------------------------------------------------------------------------
print("-- edits --")
-----------------------------------------------------------------------------
eq("delete", do_op({ "foo(bar)" }, 0, 5, function(b, r, c)
  local reg = resolve.find(b, r, c, "(")
  edit.replace_pair(b, reg, "", "")
end), { "foobar" })

eq("change to brackets", do_op({ "foo(bar)" }, 0, 5, function(b, r, c)
  local reg = resolve.find(b, r, c, "(")
  edit.replace_pair(b, reg, "[", "]")
end), { "foo[bar]" })

eq("change to multi-char", do_op({ "foo(bar)" }, 0, 5, function(b, r, c)
  local reg = resolve.find(b, r, c, "(")
  edit.replace_pair(b, reg, "<<<", ">>>")
end), { "foo<<<bar>>>" })

eq("descending order survives length change", do_op({ "(a)" }, 0, 1, function(b, r, c)
  local reg = resolve.find(b, r, c, "(")
  edit.replace_pair(b, reg, "LEFTLEFT", "R")
end), { "LEFTLEFTaR" })

eq("multiline replace", do_op({ "f(", " x", ")" }, 0, 1, function(b, r, c)
  local reg = resolve.find(b, r, c, "(")
  edit.replace_pair(b, reg, "{", "}")
end), { "f{", " x", "}" })

eq("wrap charwise", do_op({ "hello world" }, 0, 0, function(b)
  edit.wrap(b, 0, 0, 0, 5, "(", ")")
end), { "(hello) world" })

eq("wrap linewise", do_op({ "  body" }, 0, 0, function(b)
  vim.bo[b].expandtab = true
  vim.bo[b].shiftwidth = 2
  edit.wrap_lines(b, 0, 0, "{", "}")
end), { "  {", "    body", "  }" })

-----------------------------------------------------------------------------
print("-- padding trim --")
-----------------------------------------------------------------------------
do
  local function ds(lines, row, col, char)
    return do_op(lines, row, col, function(b, r, c)
      vim.api.nvim_win_set_cursor(0, { r + 1, c })
      local _ = b
      surround._pending = { kind = "delete", char = char }
      surround._repeat()
    end)
  end
  eq("open form strips padding", ds({ "x( foo )y" }, 0, 4, "("), { "xfooy" })
  eq("close form keeps padding", ds({ "x( foo )y" }, 0, 4, ")"), { "x foo y" })
  eq("single shared space is not double-trimmed", ds({ "x( )y" }, 0, 2, "("), { "x y" })
  eq("no padding, nothing to trim", ds({ "x(foo)y" }, 0, 3, "("), { "xfooy" })
end

-----------------------------------------------------------------------------
print("-- keymaps (end to end) --")
-----------------------------------------------------------------------------
do
  surround.setup({})
  local function feed(lines, row, col, keys)
    local b = mkbuf(lines, row, col)
    local k = vim.api.nvim_replace_termcodes(keys, true, false, true)
    vim.api.nvim_feedkeys(k, "mtx", false)
    vim.api.nvim_feedkeys("", "x", false)
    return vim.api.nvim_buf_get_lines(b, 0, -1, false)
  end
  eq("ds(", feed({ "foo(bar)" }, 0, 5, "ds("), { "foobar" })
  eq("cs([", feed({ "foo(bar)" }, 0, 5, "cs(["), { "foo[ bar ]" })
  eq("cs()", feed({ "foo(bar)" }, 0, 5, "cs()"), { "foo(bar)" })
  eq("ysiw)", feed({ "foo bar" }, 0, 4, "ysiw)"), { "foo (bar)" })
  eq("yss)", feed({ "  foo bar" }, 0, 4, "yss)"), { "  (foo bar)" })
  eq("keys queued behind ds( run after it", feed({ "(a) (b)" }, 0, 1, "ds(f("), { "a (b)" })
  eq("dot repeat", feed({ "(a) (b)" }, 0, 1, "ds(f(l."), { "a b" })
  eq("visual S", feed({ "foo bar" }, 0, 0, "vlleS)"), { "(foo bar)" })
end

-----------------------------------------------------------------------------
print("-- treesitter --")
-----------------------------------------------------------------------------
do
  local has = pcall(vim.treesitter.language.add, "lua")
  if not has then
    print("   (no lua parser available, skipped)")
  else
    config.opts.treesitter = true
    config.opts.scan_fallback = false
    local b = mkbuf({ 'local s = "text with ) paren"', "local t = { a = (1) }" }, 0, 15)
    vim.bo[b].filetype = "lua"
    local r = resolve.find(b, 1, 17, "(")
    ok("finds paren on line 2", r ~= nil and pos.unpack(r[1]) == 1, r)
    -- The `)` inside the string on line 1 must not be treated as a delimiter.
    local r2 = resolve.find(b, 0, 12, "(")
    ok("paren inside string is invisible", r2 == nil, r2)
    -- Edit after the tree exists: a stale tree would still say line 2.
    vim.api.nvim_buf_set_lines(b, 0, 0, false, { "-- pushed down" })
    local r3 = resolve.find(b, 2, 17, "(")
    ok("tree is reparsed after an edit", r3 ~= nil and pos.unpack(r3[1]) == 2, r3)
    config.opts.scan_fallback = true
    config.opts.treesitter = false
  end
end

-----------------------------------------------------------------------------
print("-- custom surrounds --")
-----------------------------------------------------------------------------
do
  config.surround("#", {
    add = { "#{", "}" },
    find = { kind = "pair", open = "#", close = "#" },
  })
  eq("registered pair target", locate({ "a #b# c" }, 0, 4, "#"), { 0, 2, 0, 4 })
  eq("registered add", do_op({ "x" }, 0, 0, function(b)
    local l, r = config.delimiters("#")
    edit.wrap(b, 0, 0, 0, 1, l, r)
  end), { "#{x}" })

  config.surround("@", {
    find = function(_, row, _)
      -- Deliberately trivial: proves the hook is reached and its packed
      -- return value is threaded through unchanged.
      return pos.pack(row, 1), pos.pack(row, 2), pos.pack(row, 5), pos.pack(row, 6)
    end,
  })
  eq("custom find function", locate({ "abcdefg" }, 0, 3, "@"), { 0, 1, 0, 5 })
end

-----------------------------------------------------------------------------
print("-- cursor policy --")
-----------------------------------------------------------------------------
do
  local function ds_at(lines, row, col, char, mode)
    config.opts.move_cursor = mode
    local b = mkbuf(lines, row, col)
    vim.api.nvim_win_set_cursor(0, { row + 1, col })
    local _ = b
    surround._pending = { kind = "delete", char = char }
    surround._repeat()
    local c = vim.api.nvim_win_get_cursor(0)
    return { c[1] - 1, c[2] }
  end
  -- "foo(bar)" -> "foobar";  cursor starts on `a` (col 5).
  eq("begin", ds_at({ "foo(bar)" }, 0, 5, "(", "begin"), { 0, 3 })
  eq("sticky follows the character", ds_at({ "foo(bar)" }, 0, 5, "(", "sticky"), { 0, 4 })
  eq("false restores column", ds_at({ "foo(bar)" }, 0, 5, "(", false), { 0, 5 })
  config.opts.move_cursor = "begin"
end

-----------------------------------------------------------------------------
print("-- differential vs vim's own text objects --")
-----------------------------------------------------------------------------
--
-- nvim-surround locates pairs by feeding Vim's `a(` motion and reading the
-- marks back. That is slower than scanning, but it is *authoritative*: `a(` is
-- C code that every Vim user's muscle memory is already calibrated against.
-- So use it as an oracle rather than as an implementation.
--
-- Treesitter is off here on purpose. `a(` is purely syntactic -- it happily
-- matches a paren inside a string -- so only the byte scanner is expected to
-- agree with it character for character.
do
  config.opts.treesitter = false
  local ESC = vim.api.nvim_replace_termcodes("<Esc>", true, false, true)

  local corpus = {
    { "foo(bar)" },
    { "((a))" },
    { "f(g(h(x)))" },
    { "a (b) c (d) e" },
    { "x( foo )y" },
    { "()" },
    { "( )" },
    { "no parens at all" },
    { "unbalanced ( here" },
    { "unbalanced ) here" },
    { "))((" },
    { "call(a, (b + c), d)" },
    { "f(", "  x,", "  y", ")" },
    { "a(b", "c)d" },
    { "((", "))" },
    { "(a", ")" },
  }

  --- Vim's answer, or nil when `a(` does not resolve to a real pair.
  local function vim_a(b, row, col)
    vim.api.nvim_win_set_cursor(0, { row + 1, col })
    pcall(vim.cmd.normal, { "va(" .. ESC, bang = true })
    local s = vim.api.nvim_buf_get_mark(b, "<")
    local e = vim.api.nvim_buf_get_mark(b, ">")
    local sl = vim.api.nvim_buf_get_lines(b, s[1] - 1, s[1], false)[1] or ""
    local el = vim.api.nvim_buf_get_lines(b, e[1] - 1, e[1], false)[1] or ""
    -- A failed `a(` leaves the one-character `v` selection behind, so verify
    -- the endpoints really are a paren pair before believing the marks.
    if sl:byte(s[2] + 1) ~= 40 or el:byte(e[2] + 1) ~= 41 then
      return nil
    end
    return { s[1] - 1, s[2], e[1] - 1, e[2] }
  end

  local checked, bad = 0, {}
  for _, lines in ipairs(corpus) do
    for row = 0, #lines - 1 do
      for col = 0, math.max(0, #lines[row + 1] - 1) do
        local b = mkbuf(lines, row, col)
        local want = vim_a(b, row, col)

        local got
        local r = resolve.find(b, row, col, "(")
        if r then
          local osr, osc = pos.unpack(r[1])
          local csr, csc = pos.unpack(r[3])
          got = { osr, osc, csr, csc }
        end

        checked = checked + 1
        if not vim.deep_equal(want, got) and #bad < 10 then
          bad[#bad + 1] = ("%q row %d col %d: vim=%s scan=%s"):format(
            table.concat(lines, "\\n"), row, col,
            want and vim.inspect(want, { newline = "", indent = "" }) or "nil",
            got and vim.inspect(got, { newline = "", indent = "" }) or "nil"
          )
        end
      end
    end
  end

  ok(("scanner agrees with `a(` on %d positions"):format(checked), #bad == 0)
  for _, b in ipairs(bad) do
    io.write("      " .. b .. "\n")
  end
end

io.write(("\n%d passed, %d failed\n"):format(passed, failed))
if failed > 0 then
  os.exit(1)
end
