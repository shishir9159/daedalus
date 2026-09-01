local clue = require('mini.clue')

-- SpaceVim-style mnemonic groups. The popup is only the discovery layer —
-- the grouping itself is the leader-prefix convention below, and every
-- keymap's `desc` is what shows up in the window.
clue.setup({
  triggers = {
    { mode = 'n', keys = '<Leader>' },
    { mode = 'x', keys = '<Leader>' },
    { mode = 'n', keys = 'g' }, -- includes builtin grn/gra/grr/gri
    { mode = 'x', keys = 'g' },
    { mode = 'n', keys = 'z' }, -- folds, spell
    { mode = 'n', keys = '[' },
    { mode = 'n', keys = ']' },
    { mode = 'n', keys = '"' }, -- registers
    { mode = 'x', keys = '"' },
    { mode = 'i', keys = '<C-r>' },
    { mode = 'n', keys = '<C-w>' }, -- windows
    { mode = 'n', keys = 's' }, -- mini.surround
  },

  clues = {
    -- leader groups: the mnemonic layer
    { mode = 'n', keys = '<Leader>b', desc = '+buffer' },
    { mode = 'n', keys = '<Leader>c', desc = '+code' },
    { mode = 'n', keys = '<Leader>d', desc = '+debug' },
    { mode = 'n', keys = '<Leader>f', desc = '+find' },
    { mode = 'n', keys = '<Leader>g', desc = '+git' },
    { mode = 'n', keys = '<Leader>t', desc = '+toggle' },
    { mode = 'n', keys = '<Leader>x', desc = '+diagnostics' },

    -- descriptions for builtin/plugin keys we didn't define ourselves
    clue.gen_clues.builtin_completion(),
    clue.gen_clues.g(),
    clue.gen_clues.marks(),
    clue.gen_clues.registers(),
    clue.gen_clues.windows(),
    clue.gen_clues.z(),
  },

  window = {
    delay = 300,
    config = { width = 'auto', border = 'rounded' },
  },
})
