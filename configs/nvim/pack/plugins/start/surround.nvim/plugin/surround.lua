if vim.g.loaded_surround then
  return
end
vim.g.loaded_surround = 1

-- `surround_configured` is set by setup(). Under a pack/*/start/ install this
-- file is sourced after init.lua, so setup() may already have installed the
-- user's keymaps; don't stomp them with the defaults.
if vim.g.surround_no_default_mappings ~= 1 and vim.g.surround_configured ~= 1 then
  -- keymaps.lua requires nothing else at load time; the rest of the plugin is
  -- pulled in by the first keypress.
  require("surround.keymaps").apply()
end

vim.api.nvim_create_autocmd({ "BufDelete", "BufWipeout" }, {
  group = vim.api.nvim_create_augroup("surround_cache", { clear = true }),
  callback = function(ev)
    -- Don't force-load the module just to clear a cache it may never have had.
    if package.loaded["surround.resolve"] then
      require("surround.resolve").invalidate(ev.buf)
    end
  end,
})
