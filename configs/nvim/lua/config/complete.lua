require('blink.cmp').setup({
  keymap = { preset = 'default' },
  completion = {
    documentation = { auto_show = true, auto_show_delay_ms = 200 },
    ghost_text = { enabled = true }, -- inline preview of the top suggestion
  },
  signature = { enabled = true },
  fuzzy = { implementation = 'prefer_rust_with_warning' },
  -- completion for `:` commands and `/`,`?` search too
  cmdline = {
    enabled = true,
    completion = { menu = { auto_show = true } },
  },
})
