# daedalus for dotfiles

| Path | What | Goes to |
|---|---|---|
| `hyprland-multishell/` | several Hyprland rices side by side: profiles, greeter sessions, colour locks, backups | `~/.rices` via its `install.sh`, or dotter (`.dotter/`, package `hyprland`); see its README |
| `linux/zsh.rc` | zsh config | `~/.zshrc` |
| `linux/manjaro-bootstrap.sh` | packages and toolchains for a fresh Manjaro | run by hand, step by step |
| `configs/nvim/` | Neovim 0.12 config | `~/.config/nvim`; see its README |
| `configs/okular/` | Okular settings | `~/.config/` |
| `configs/vesktop/pichu.css` | Vesktop theme (Emberkeep) | `~/.config/vesktop/themes/` |
| `configs/Obsidian/Vault/` | CSS snippets and Datacore views | same paths inside the vault |
| `windows/` | PowerShell profile, oh-my-posh theme | see `windows/readme.md` |

`.gitignore` is a whitelist: a new file stays untracked until it gets a line there.

## Notes

Todo: take Inspiration again for new configuration:

https://github.com/prasanthrangan/hyprdots 5766d02

```Bash
grep -E "(ctrl|caps):" /usr/share/X11/xkb/rules/base.lst
grep -E "caps:swapescape" /usr/share/X11/xkb/rules/base.lst
# for temporary change for the session
setxkbmap -option caps:swapescape
```

for just file
```zsh
just --completions zsh > /tmp/_just
fpath += /tmp
compinit
source <(just --completions bash)
```
