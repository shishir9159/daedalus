return {
  cmd = { 'ruff', 'server' },
  filetypes = { 'python' },
  root_markers = { 'pyproject.toml', 'ruff.toml', '.ruff.toml', '.git' },
  -- ty owns hover; ruff only lints and formats
  on_init = function(client) client.server_capabilities.hoverProvider = false end,
}
