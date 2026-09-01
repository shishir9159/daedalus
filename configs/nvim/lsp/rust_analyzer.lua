return {
  cmd = { 'rust-analyzer' },
  filetypes = { 'rust' },
  root_markers = { 'Cargo.toml', '.git' },
  settings = {
    ['rust-analyzer'] = {
      check = { command = 'clippy' },
      cargo = { allFeatures = true },
      lens = { enable = true, run = { enable = true }, debug = { enable = true },
        implementations = { enable = true }, references = { adt = { enable = true } } },
    },
  },
}
