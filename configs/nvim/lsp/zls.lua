return {
  cmd = { 'zls' },
  filetypes = { 'zig', 'zir' },
  root_markers = { 'zls.json', 'build.zig', '.git' },
  settings = {
    zls = {
      -- runs `zig build --watch` in the background and reports build errors
      -- as diagnostics; prefers a 'check' step if build.zig declares one
      enable_build_on_save = true,
      build_on_save_args = { '-fincremental' },
    },
  },
}
