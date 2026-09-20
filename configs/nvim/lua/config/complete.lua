require('blink.cmp').setup({
  completion = {
    documentation = { auto_show = true, auto_show_delay_ms = 200 },
    ghost_text = { enabled = true }, -- inline preview of the top suggestion
  },
  signature = { enabled = true },
  -- the `:` and `/`,`?` cmdline menu pops up without <Tab>
  cmdline = { completion = { menu = { auto_show = true } } },
})
