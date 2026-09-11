# Contributing

- **Commits:** one change each; the subject in lowercase past tense with no
  type prefix, as in `git log` (`fixed surround.nvim pair search on nvim 0.9 to
  0.11`). Say why in the body when it isn't obvious.
- **New files:** `.gitignore` is a whitelist; a new file stays untracked until
  it gets a `!` line there.
- **Tests:** `hyprland-multishell/tests/run.sh` and `tests/shellcheck.sh` (CI
  runs both on changes there); `nvim -l tests/run.lua` inside surround.nvim.
- **Line endings:** LF everywhere (`.gitattributes`): edited on Windows, run on Linux.
