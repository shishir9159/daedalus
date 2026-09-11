#!/usr/bin/env bash
# rice-update: clone, keeping local work (untracked files too), rebasing onto
# upstream, and -- the bugs this exists for -- never committing conflict
# markers, never leaving a half-rebased tree, never resetting 'mine'.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
setup
mkprofile up
UP="$SANDBOX/upstream"
R="$PD/config/quickshell/shell"

commit_upstream() { # commit_upstream <file> <content>
    printf '%s\n' "$2" > "$UP/$1"
    git -C "$UP" add -A && git -C "$UP" commit -qm "upstream: $1"
}
git init -q -b main "$UP"
commit_upstream a.qml 'line1'
commit_upstream b.qml 'b'

section "clone"
printf 'config/quickshell/shell  %s\n' "$UP" > "$PD/repos.txt"   # no branch: detect it
expect "first run clones"                    rice-update up
expect "on branch mine"                      test "$(git -C "$R" branch --show-current)" = mine
expect "remote is called upstream"           git -C "$R" remote get-url upstream

section "local work is kept, new files included"
echo 'my widget' > "$R/mywidget.qml"
echo 'b, edited' > "$R/b.qml"
commit_upstream c.qml 'from upstream'
expect "update"                              rice-update up
expect "untracked file committed on mine"    git -C "$R" cat-file -e mine:mywidget.qml
expect "local edit kept"                     has "$R/b.qml" 'b, edited'
expect "upstream change arrived"             test -f "$R/c.qml"

section "conflict: abort, keep working version, never commit markers"
echo 'mine' > "$R/a.qml"
commit_upstream a.qml 'theirs'
refute "update reports failure"              rice-update up
refute "not left mid-rebase"                 test -d "$R/.git/rebase-merge"
expect "working tree has my version"         has "$R/a.qml" 'mine'
refute "no conflict markers in the tree"     grep -rq '<<<<<<<' "$R" --exclude-dir=.git
expect "still on mine"                       test "$(git -C "$R" branch --show-current)" = mine
refute "second run fails the same way"       rice-update up
refute "no conflict markers in any commit"   bash -c "git -C '$R' log -p mine | grep -q '<<<<<<<'"

section "an unfinished manual rebase is left alone"
git -C "$R" rebase -q upstream/main >/dev/null 2>&1 || true   # leaves the conflict in place
before="$(git -C "$R" rev-list --all | wc -l)"
refute "update refuses"                      rice-update up
expect "and commits nothing"                 test "$(git -C "$R" rev-list --all | wc -l)" -eq "$before"
git -C "$R" rebase --abort

section "'mine' is never reset from another branch"
git -C "$R" checkout -q mine
git -C "$R" reset -q --hard upstream/main~1     # drop the conflicting local commit
echo 'keep me' > "$R/keep.qml"; git -C "$R" add -A; git -C "$R" commit -qm 'my precious commit'
git -C "$R" checkout -q -b experiment upstream/main
rice-update up >/dev/null 2>&1
expect "my commit is still on mine"          bash -c "git -C '$R' log --format=%s mine | grep -q 'my precious commit'"
expect "switched back to mine"               test "$(git -C "$R" branch --show-current)" = mine

section "one bad repo does not stop the rest"
rm -rf "$R"
printf '%s\n' 'config/quickshell/bad  /nonexistent/repo  main' \
              "config/quickshell/shell  $UP  main" > "$PD/repos.txt"
refute "exit status reports the failure"     rice-update up
expect "the good repo was still cloned"      test -d "$R/.git"

finish
