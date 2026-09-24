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
o.timeoutlen = 400 -- mini.clue's popup (300ms) shows just before a mapping times out

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

-- Per-mode cursor shape; each segment ends in its colour group (Cursor*, set in
-- config/theme.lua). Shape and colour encode what an edit will do:
--   normal   block            resting on a character, ready to act on it
--   visual   block, blinks    selecting
--   insert   bar              text lands between characters
--   replace  underline        the char beneath will be overwritten
--   op-pend  thick underline  half-committed: waiting for a motion
--   command  bar              typing into the cmdline
-- Needs a terminal that honours DECSCUSR + OSC-12 (kitty/ghostty/wezterm do).
o.guicursor = table.concat({
  'n-sm:block-CursorNormal',
  'v-ve:block-CursorVisual-blinkwait700-blinkon400-blinkoff250',
  'i-ci:ver25-CursorInsert-blinkwait700-blinkon400-blinkoff250',
  'r-cr:hor20-CursorReplace-blinkwait700-blinkon400-blinkoff250',
  'o:hor50-CursorOp',
  'c:ver25-CursorCommand',
}, ',')
