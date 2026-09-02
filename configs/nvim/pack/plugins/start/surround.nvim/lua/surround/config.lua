--- Delimiter definitions and user options.
---
--- Two separate tables on purpose:
---   * `find`  - how to *locate* an existing pair (target of ds/cs)
---   * `add`   - what to *insert* (the surround-with char of ys/cs/S)
--- tpope's convention: the opening char pads with spaces, the closing char is
--- tight. `ys$(` -> `( foo )`, `ys$)` -> `(foo)`.
local M = {}

---@class surround.Target
---@field kind "pair"|"quote"|"tag"|"func"
---@field open string
---@field close string

---@type table<string, surround.Target>
local find = {}

local function pair(chars, open, close)
  local t = { kind = "pair", open = open, close = close }
  for c in chars:gmatch(".") do
    find[c] = t
  end
end

local function quote(c)
  find[c] = { kind = "quote", open = c, close = c }
end

pair("()b", "(", ")")
pair("{}B", "{", "}")
pair("[]r", "[", "]")
pair("<>a", "<", ">")

quote('"')
quote("'")
quote("`")

find["q"] = { kind = "quote", open = "q", close = "q" } -- any of " ' `
find["t"] = { kind = "tag", open = "<", close = ">" }
find["<"] = find["t"] -- tpope treats `<` and `t` alike; `a` is the <> pair
find["f"] = { kind = "func", open = "(", close = ")" }
find["F"] = { kind = "func", open = "(", close = ")" }

M.find = find

--- Static insertions. Anything not here is resolved dynamically (t/f/q) or
--- falls back to `{char, char}` so `ys$*` gives `*foo*`.
---@type table<string, string[]>
M.add = {
  ["("] = { "( ", " )" },
  [")"] = { "(", ")" },
  ["b"] = { "(", ")" },
  ["{"] = { "{ ", " }" },
  ["}"] = { "{", "}" },
  ["B"] = { "{", "}" },
  ["["] = { "[ ", " ]" },
  ["]"] = { "[", "]" },
  ["r"] = { "[", "]" },
  ["<"] = { "< ", " >" },
  [">"] = { "<", ">" },
  ["a"] = { "<", ">" },
}

--- Register or override a single surround character.
---
--- Borrowed from nvim-surround, whose best structural idea is that a surround
--- is a *record* of operations keyed by character rather than a branch in a
--- hardcoded switch. It's what lets a user add `#{...}` or a language-specific
--- pair without patching the plugin.
---
--- `find` may be:
---   * `{ kind = "pair"|"quote", open = "...", close = "..." }`
---   * `function(buf, row, col) -> o_s, o_e, c_s, c_e` (packed, end-exclusive)
---@param char string
---@param spec { add?: string[], find?: table|function }
function M.surround(char, spec)
  if spec.add ~= nil then
    M.add[char] = spec.add
  end
  if spec.find ~= nil then
    if type(spec.find) == "function" then
      M.find[char] = { kind = "custom", fn = spec.find }
    elseif spec.find.kind == "pair" and spec.find.open == spec.find.close then
      -- Identical delimiters cannot nest, so depth counting is meaningless on
      -- them. Normalise here rather than letting the pair scanner return
      -- silent garbage for `{ kind = "pair", open = "#", close = "#" }`.
      M.find[char] = { kind = "quote", open = spec.find.open, close = spec.find.close }
    else
      M.find[char] = spec.find
    end
  end
end

M.opts = {
  --- Use the treesitter tree when a parser is loaded. This is the article's
  --- "reuse the editor's token stream" point: the tree is already built and
  --- incrementally maintained by the C parser, so an enclosing-pair query is
  --- O(depth) ancestor hops with zero scanning -- and it is correct about
  --- brackets inside strings and comments, which no regex scan can be.
  treesitter = true,

  --- If treesitter is loaded but finds nothing, still run the byte scanner.
  --- Trades a little correctness (a `(` in a comment may match) for the
  --- plugin behaving predictably in grammars whose nodes don't align with
  --- delimiters. Set false if you want strict tree semantics.
  scan_fallback = true,

  --- VS Code bounds error recovery with anchor sets so an unmatched bracket
  --- can't drag the parser across the document. Same idea: cap how far a
  --- failed scan walks. 0 = unbounded.
  scan_radius = 400, -- lines, in each direction

  --- Lines fetched per nvim_buf_get_lines call during a scan. Fetching the
  --- whole buffer is the single most common perf bug in surround plugins.
  chunk = 128,

  --- Honour backslash escapes when matching quotes.
  escapes = true,

  --- For quotes: if the cursor isn't inside one, take the next pair on the
  --- current line (tpope's behaviour).
  quote_search_forward = true,

  --- Where the cursor lands after an operation.
  ---   "begin"  start of the (former) opening delimiter -- vim-surround's
  ---   "sticky" stay on the same character you were on
  ---   false    restore the original row/column
  --- "sticky" is the one case in this plugin where an extmark earns its keep:
  --- unlike the delimiter positions, the cursor genuinely does need remapping
  --- across the edits.
  move_cursor = "begin",

  keymaps = {
    normal = "ys",
    normal_cur = "yss",
    normal_line = "yS",
    normal_cur_line = "ySS",
    visual = "S",
    delete = "ds",
    change = "cs",
  },
}

function M.setup(user)
  if not user then
    return
  end
  for k, v in pairs(user) do
    if k == "keymaps" and type(v) == "table" then
      for mk, mv in pairs(v) do
        M.opts.keymaps[mk] = mv
      end
    elseif k == "add" and type(v) == "table" then
      for ak, av in pairs(v) do
        M.add[ak] = av
      end
    elseif k == "surrounds" and type(v) == "table" then
      for sk, sv in pairs(v) do
        M.surround(sk, sv)
      end
    else
      M.opts[k] = v
    end
  end
end

--- Resolve the insertion text for a surround char.
---@param char string
---@return string left, string right
function M.delimiters(char)
  local d = M.add[char]
  if d then
    return d[1], d[2]
  end
  return char, char
end

return M
