# Starship

`windows/shishir.omp.toml` (oh-my-posh) ported to [Starship](https://starship.rs),
for bash so far.

| File | Goes to |
|---|---|
| `starship.toml` | `~/.config/starship.toml` |
| `starship.bash` | `~/.config/starship/starship.bash`, sourced from `~/.bashrc` |

Both are the dotter package `starship`. Trying it in a shell without
deploying: `. configs/starship/starship.bash`.

Needs a Nerd Font (FantasqueSansM Nerd Font has every glyph used). The glyphs
are written as escapes in `starship.toml`, so an editor that drops Private Use
Area characters can't blank them; keep it that way when adding one.

## The bar

Path, git, languages, jobs, duration and the status heart on the left; shell,
battery and clock on the right. Colours are named in `[palettes.shishir]`.

A Starship module can't see its neighbours, so an optional segment can't know
which colour to join. Each one opens with a notch and closes with an arrow:
any subset interlocks with a chevron gap, the way oh-my-posh joins its
execution time. The duration and the heart are always there and join
seamlessly.

Not carried over: the whole git segment changing colour (ahead/behind,
diverged and changes get segments of their own in those colours), the path
turning black after a failure (the heart says it), battery colour by charge
state (one colour, the icon changes), the upstream host icon, and the ytm,
azfunc, aws and root segments.

## Transient prompt (bash)

`starship.bash` replaces `eval "$(starship init bash)"`. On Enter the bar and
the command collapse into one line, a face for the state the prompt was in
and the command, with the time Enter was pressed on the right:

| Face | When |
|---|---|
| `(^-^)` | the previous command succeeded |
| `(^_^)` | it called `starship_warn` (a prompt sees exit codes, not output) |
| `>_<` | it failed |

When the command finishes, that time becomes how long it took. That needs the
line where it was drawn: if the command's output scrolled the screen, no shell
can find the line again, so the press time stays. A command that prints
nothing always gets its duration; one that prints, while the screen still has
room below the line.

The right prompt and the transient line are drawn around readline, so readline
can't redraw them: editing a line can erase the right prompt.

It also sets the terminal title to `bash in <dir>`, as the oh-my-posh theme
did. Multi-line input, Ctrl-C and blank lines are handled; vi mode too.
