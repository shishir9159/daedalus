return {
  cmd = { 'ty', 'server' },
  filetypes = { 'python' },
  root_markers = { 'ty.toml', 'pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', '.git' },
  -- python formats via ruff
  on_init = function(client) client.server_capabilities.documentFormattingProvider = false end,
}
