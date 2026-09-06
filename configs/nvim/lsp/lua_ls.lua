-- Tuned for editing this config: knows the `vim` global and the Neovim
-- runtime. A project-local .luarc.json overrides all of this.
return {
  cmd = { 'lua-language-server' },
  filetypes = { 'lua' },
  root_markers = {
    '.luarc.json',
    '.luarc.jsonc',
    '.stylua.toml',
    'stylua.toml',
    'selene.toml',
    '.git',
  },
  settings = {
    Lua = {
      runtime = { version = 'LuaJIT', path = { 'lua/?.lua', 'lua/?/init.lua' } },
      workspace = {
        -- VIMRUNTIME only (it has the vim.uv types too since 0.12); pulling in
        -- every plugin's lua/ makes startup crawl
        library = { vim.env.VIMRUNTIME .. '/lua' },
        checkThirdParty = false,
      },
      diagnostics = { globals = { 'vim' } },
      hint = { enable = true, arrayIndex = 'Disable' },
      codeLens = { enable = true },
      format = { enable = true, defaultConfig = { indent_style = 'space', indent_size = '2' } },
      telemetry = { enable = false },
    },
  },
}
