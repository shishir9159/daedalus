local o = vim.o

o.number = true
o.relativenumber = true
o.signcolumn = 'yes'
o.cursorline = true
o.wrap = false
o.scrolloff = 6

o.ignorecase = true
o.smartcase = true
o.inccommand = 'split' -- live preview of :s substitutions

o.splitright = true
o.splitbelow = true
o.splitkeep = 'screen' -- don't scroll text when opening/closing splits

o.undofile = true
o.confirm = true
o.updatetime = 250
o.timeoutlen = 400 -- snappier which-key-less mapping feedback

-- ftplugins override where the language disagrees (go uses tabs)
o.expandtab = true
o.shiftwidth = 4
o.tabstop = 4
o.breakindent = true -- wrapped lines keep their indent

o.smoothscroll = true -- scroll by screen line on wrapped/long lines
o.pumheight = 12 -- cap completion popup height
o.sidescrolloff = 8
o.virtualedit = 'block' -- let visual-block select past line ends
o.jumpoptions = 'stack,view' -- saner <C-o>/<C-i> jumplist

-- treesitter-powered folding, but start fully unfolded (nothing hidden)
o.foldmethod = 'expr'
o.foldexpr = 'v:lua.vim.treesitter.foldexpr()'
o.foldtext = ''
o.foldlevelstart = 99

-- subtle whitespace/eol hints; tabs and trailing space become visible
o.list = true
o.listchars = 'tab:» ,trail:·,nbsp:␣'

o.winborder = 'rounded'
o.clipboard = 'unnamedplus'

-- Per-mode cursor shape + colour. Both encode what an edit will do:
--   normal   block,   lavender   resting on a character, ready to act on it
--   visual   block,   mauve      selecting (blink also sets it apart)
--   insert   bar,     green      text lands between characters ("go")
--   replace  underln, red        the char beneath will be overwritten
--   op-pend  thick underln, yellow   half-committed: waiting for a motion
--   command  bar,     blue       typing into the cmdline
-- The trailing name in each segment is a highlight group (defined below).
-- Needs a terminal that honours DECSCUSR + OSC-12 (kitty/ghostty/wezterm do).
o.guicursor = table.concat({
  'n-sm:block-CursorNormal',
  'v-ve:block-CursorVisual-blinkwait700-blinkon400-blinkoff250',
  'i-ci:ver25-CursorInsert-blinkwait700-blinkon400-blinkoff250',
  'r-cr:hor20-CursorReplace-blinkwait700-blinkon400-blinkoff250',
  'o:hor50-CursorOp',
  'c:ver25-CursorCommand',
}, ',')

-- Cursor colours live in highlight groups so they survive :colorscheme (which
-- would otherwise wipe them) via the ColorScheme autocmd. `bg` is the caret
-- colour; `fg` is the glyph seen through a block cursor, so it's set to the UI
-- background for contrast.
local function set_cursor_colors()
  local base = '#1e1e2e'
  for group, color in pairs({
    CursorNormal = '#cdd6f4', -- lavender / text
    CursorVisual = '#cba6f7', -- mauve
    CursorInsert = '#a6e3a1', -- green
    CursorReplace = '#f38ba8', -- red
    CursorOp = '#f9e2af', -- yellow
    CursorCommand = '#89b4fa', -- blue
  }) do
    vim.api.nvim_set_hl(0, group, { fg = base, bg = color })
  end
end
set_cursor_colors()
vim.api.nvim_create_autocmd('ColorScheme', {
  group = vim.api.nvim_create_augroup('config.cursor', {}),
  callback = set_cursor_colors,
})
