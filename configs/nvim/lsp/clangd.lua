-- Formatting follows the project's .clang-format (falls back to LLVM style).
-- compile_commands.json gives the best results; generate it with
-- `cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=1` or `bear -- make`.
return {
  cmd = {
    'clangd',
    '--background-index',
    '--clang-tidy',
    '--header-insertion=iwyu',
    '--completion-style=detailed',
    '--function-arg-placeholders',
    '--fallback-style=llvm',
  },
  filetypes = { 'c', 'cpp', 'objc', 'objcpp', 'cuda' },
  root_markers = {
    '.clangd',
    '.clang-format',
    'compile_commands.json',
    'compile_flags.txt',
    'CMakeLists.txt',
    'Makefile',
    'meson.build',
    '.git',
  },
  init_options = {
    usePlaceholders = true,
    completeUnimported = true,
    clangdFileStatus = true,
  },
}
