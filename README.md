# daedalus for dotfiles


Took Inspiration for the late stage project:

https://github.com/prasanthrangan/hyprdots 5766d02

```Bash
grep -E "(ctrl|caps):" /usr/share/X11/xkb/rules/base.lst
grep -E "caps:swapescape" /usr/share/X11/xkb/rules/base.lst
# for temporary change for the session
setxkbmap -option caps:swapescape
```