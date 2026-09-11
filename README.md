# dotfiles

## Notes to Self

Todo:

- take inspiration again for new configuration: https://github.com/prasanthrangan/hyprdots 5766d02
- configure wezterm per distro: https://github.com/KevinSilvester/wezterm-config,
  https://github.com/XNM1/linux-nixos-hyprland-config-dotfiles, https://github.com/catppuccin/wezterm

```bash
grep -E "(ctrl|caps):" /usr/share/X11/xkb/rules/base.lst
grep -E "caps:swapescape" /usr/share/X11/xkb/rules/base.lst
# for temporary change for the session
setxkbmap -option caps:swapescape
```

just completions:
```zsh
just --completions zsh > /tmp/_just
fpath+=(/tmp)
compinit
```
