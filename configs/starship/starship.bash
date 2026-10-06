# shellcheck shell=bash
# Starship for bash, in place of `eval "$(starship init bash)"` (don't use
# both). Source it from ~/.bashrc; dotter links it to ~/.config/starship/.
# On top of the prompt it adds what bash doesn't get from starship:
#   - the right prompt (shell, battery, clock), on the bar's line
#   - the terminal title, "bash in <dir>", as the oh-my-posh theme sets it
#   - a transient prompt: Enter collapses the bar and the command to a
#     kaomoji pill and the command, with the time Enter was pressed on the
#     right. When the command finishes, that time becomes how long it took.
# The swap needs the line where it was drawn: when the command's output
# scrolled the screen, no shell can find it again, and the press time stays.

[[ $- == *i* ]] && command -v starship >/dev/null || return 0
# PS0 (4.4) and EPOCHREALTIME (5.0) carry the timing.
if (( BASH_VERSINFO[0] < 5 )); then eval "$(starship init bash)"; return 0; fi

# The config next to this file; starship.exe on Git Bash wants a Windows path.
__ss_base=$(readlink -f "${BASH_SOURCE[0]}") && __ss_base=${__ss_base%/*}/starship.toml
if [[ $OSTYPE == msys || $OSTYPE == cygwin ]]; then __ss_base=$(cygpath -m "$__ss_base"); fi

export STARSHIP_SHELL=bash
shopt -s checkwinsize

# State, kept when ~/.bashrc is sourced again.
if [[ -z ${__ss_loaded-} ]]; then
    __ss_loaded=1
    __ss_user_config=${STARSHIP_CONFIG-}   # set by hand: always used
    STARSHIP_SESSION_KEY=$RANDOM$RANDOM$RANDOM$RANDOM$RANDOM$RANDOM
    export STARSHIP_SESSION_KEY=${STARSHIP_SESSION_KEY:0:16}
    __ss_t0=${EPOCHREALTIME//[!0-9]/}   # microseconds at Enter; first prompt: since startup
    __ss_last=0       # ms the last command took
    __ss_lines=()     # each line Enter accepted since the last prompt
    __ss_n=0 __ss_ran=0 __ss_r1=0 __ss_cols=0 __ss_rown=0 __ss_warn='' __ss_nil=''
    __ss_face_w=0     # 0: no transient prompt this time
    __ss_bytes=0      # 1: the locale isn't UTF-8 (__ss_width)
fi

# Give the next transient face the warning look, from a function that knows
# the command misbehaved without failing. A prompt sees exit codes, not output.
starship_warn() { __ss_warn=1; }

__ss_return() { return "$1"; }

__ss_config() {
    [[ $__ss_user_config ]] || export STARSHIP_CONFIG=$__ss_base
}

# REPLY: $1 as displayed, without \[...\] and escape sequences (__ss_width).
__ss_visible() {
    local s=$1 out=
    while [[ $s == *'\['*'\]'* ]]; do out+=${s%%'\['*}; s=${s#*'\]'}; done
    s=$out$s out=
    while [[ $s == *$'\e'* ]]; do out+=${s%%$'\e'*}; s=${s#*$'\e'}; s=${s#*[A-Za-z]}; done
    __ss_width "$out$s"
}

# REPLY: $1 with ${#REPLY} its width. Outside a UTF-8 locale ${#} counts
# bytes, so UTF-8 continuation bytes are dropped.
__ss_width() {
    REPLY=$1
    if ((__ss_bytes)); then REPLY=${REPLY//[$'\x80'-$'\xbf']/}; fi
}

# REPLY: milliseconds as cmd_duration prints them (show_milliseconds).
__ss_dur() {
    local ms=$1 d h m s
    d=$((ms / 86400000)) h=$((ms / 3600000 % 24)) m=$((ms / 60000 % 60)) s=$((ms / 1000 % 60))
    REPLY=
    if ((d)); then REPLY+=${d}d; fi
    if ((h)); then REPLY+=${h}h; fi
    if ((m)); then REPLY+=${m}m; fi
    if ((s)); then REPLY+=${s}s; fi
    REPLY+=$((ms % 1000))ms
}

# The cursor's row, asked of the terminal; fails if it doesn't answer.
# Typeahead would be read as the answer and lost, so none may be pending.
__ss_row() {
    local r c
    if read -t 0 </dev/tty; then return 1; fi
    printf '\e[6n' >/dev/tty
    IFS='[;' read -rs -d R -t 0.5 _ r c </dev/tty && [[ $r ]] && printf '%s' "$r"
}

# Enter: keep the line (multi-line input is one Enter per line) for the
# transient prompt, which redraws it.
__ss_snap() { __ss_lines+=("$READLINE_LINE"); }

# From the first __ss_n entered lines and the last prompt's widths:
#   __ss_up   rows the prompt and those lines took, up to the cursor
#   __ss_tx   the transient line(s) that replace them
#   __ss_end  columns the transient uses on its last row
#   __ss_at   column for the press time, 0 if it doesn't fit there
__ss_layout() {
    local i s sub w p q r=1
    __ss_up=$__ss_head_rows __ss_tx="$__ss_face " __ss_end=0
    for ((i = 0; i < __ss_n; i++)); do
        s=${__ss_lines[i]}
        p=$__ss_ps2_w q=$__ss_ps2_w
        if ((i)); then __ss_tx+=$'\n'$__ss_ps2; else p=$__ss_bar_w q=$((__ss_face_w + 1)); fi
        while :; do   # pasted input can hold newlines; readline breaks the line there
            sub=${s%%$'\n'*} sub=${sub//[[:cntrl:]]/?}
            __ss_width "$sub"
            w=$((p + ${#REPLY}))
            ((__ss_up += w ? (w + COLUMNS - 1) / COLUMNS : 1))
            w=$((q + ${#REPLY})) r=$((w ? (w + COLUMNS - 1) / COLUMNS : 1))
            __ss_end=$((w - (r - 1) * COLUMNS)) __ss_tx+=$sub
            [[ $s == *$'\n'* ]] || break
            s=${s#*$'\n'} p=0 q=0 __ss_tx+=$'\n'
        done
    done
    __ss_at=$((COLUMNS - __ss_at_w))
    if ((__ss_at <= __ss_end + 1)); then __ss_at=0; fi
}

# Replace what Enter left on screen with the transient line; "at": with the
# press time on the right. The cursor ends on the next line, where the
# command's output will go.
__ss_draw() {
    local now right=
    ((__ss_face_w && __ss_n)) || return 1
    # history expansion prints the expanded line too, which the rows miss
    if [[ $- == *H* && ${__ss_lines[*]:0:__ss_n} == *'!'* ]]; then return 1; fi
    __ss_layout
    ((__ss_up < LINES)) || return 1
    if [[ $1 == at ]] && ((__ss_at)); then
        printf -v now '%(%H:%M:%S)T' -1
        right=$'\e['$__ss_at'G'${__ss_at_tpl//@T@/$now}
    fi
    printf '\e[%dA\r\e[J%s%s\e[0m\n' "$__ss_up" "$__ss_tx" "$right" >/dev/tty
}

# PS0, in a subshell: draw, then print the row the cursor is on (0 if
# unknown) so the prompt after the command can find the line.
__ss_ps0() {
    __ss_n=${#__ss_lines[@]}
    if __ss_draw at && __ss_row; then return; fi
    echo 0
}

# Before the next prompt: the press time on the transient line becomes the
# duration, if the line can still be found. The cursor must not have reached
# the bottom row (output may have scrolled the screen) or gone above the line
# (cleared), and the terminal must be the same size.
__ss_finish() {
    local r2 pill col
    ((__ss_r1 > 1 && COLUMNS == __ss_cols && LINES == __ss_rown)) || return
    __ss_layout
    ((__ss_at)) || return
    r2=$(__ss_row) || return
    ((r2 >= __ss_r1 && r2 < LINES)) || return
    __ss_dur "$__ss_last"
    pill=${__ss_took_tpl//@D@/$REPLY}
    __ss_visible "$pill"
    col=$((COLUMNS - ${#REPLY}))
    ((col > __ss_end + 1)) || return
    printf '\e7\e[%d;%dH\e[0m\e[K\e[%dG%s\e[0m\e8' "$((__ss_r1 - 1))" "$__ss_at" "$col" "$pill" >/dev/tty
}

# Enter on a blank or comment-only line runs nothing, so PS0 never came.
__ss_entered_nothing() {
    local l re='^[[:space:]]*(#.*)?$'
    ((${#__ss_lines[@]})) || return 1
    for l in "${__ss_lines[@]}"; do [[ $l =~ $re ]] || return 1; done
}

__ss_precmd() {
    local st=$? ps=("${PIPESTATUS[@]}") c n=0 x right
    if [[ ${BP_PIPESTATUS-} ]]; then ps=("${BP_PIPESTATUS[@]}"); fi
    if [[ $__ss_t0 ]]; then __ss_last=$(((${EPOCHREALTIME//[!0-9]/} - __ss_t0) / 1000)) __ss_t0=; fi
    for c in "${__ss_user_pc[@]}"; do __ss_return "$st"; eval "$c"; done

    # last prompt's transient line, with that prompt's widths and face
    if ((__ss_ran)); then
        __ss_finish
    elif __ss_entered_nothing; then
        __ss_n=${#__ss_lines[@]}
        __ss_draw
    fi
    __ss_lines=() __ss_ran=0 __ss_r1=0

    # A process started in PROMPT_COMMAND can show up as a job; listing the
    # finished ones first clears it (what starship's init does).
    jobs &>/dev/null
    for _ in $(jobs -p); do ((n++)); done

    __ss_config
    x=$'\xc3\xa9' __ss_bytes=$((${#x} > 1))   # U+00E9: one character, or two bytes outside UTF-8
    PS1=$(starship prompt --terminal-width="$COLUMNS" --status="$st" --pipestatus="${ps[*]}" \
        --jobs="$n" --cmd-duration="$__ss_last" --shlvl="$SHLVL")
    x=$(STARSHIP_TRANSIENT_OK=1 STARSHIP_TRANSIENT_WARN=1 STARSHIP_TRANSIENT_ERR=1 \
        STARSHIP_TRANSIENT_AT=@T@ STARSHIP_TRANSIENT_TOOK=@D@ \
        starship prompt --profile bash --terminal-width="$COLUMNS")
    x=${x//'\['/} x=${x//'\]'/}
    local -a part=()
    while [[ $x == *$'\x1f'* ]]; do part+=("${x%%$'\x1f'*}"); x=${x#*$'\x1f'}; done
    part+=("$x")

    # the bar is the last line; the lines above it are one row each
    local head='' bar=$PS1
    if [[ $PS1 == *$'\n'* ]]; then head=${PS1%$'\n'*}$'\n' bar=${PS1##*$'\n'}; fi
    __ss_visible "$bar"; __ss_bar_w=${#REPLY}
    __ss_head_rows=0 x=$head
    while [[ $x == *$'\n'* ]]; do ((__ss_head_rows++)); x=${x#*$'\n'}; done
    __ss_visible "$PS2"; __ss_ps2_w=${#REPLY}
    __ss_ps2=${PS2//'\['/} __ss_ps2=${__ss_ps2//'\]'/}

    __ss_face_w=0 right=
    if ((${#part[@]} == 6)); then
        right=${part[0]} __ss_at_tpl=${part[4]} __ss_took_tpl=${part[5]}
        if ((st)); then __ss_face=${part[3]}; elif [[ $__ss_warn ]]; then __ss_face=${part[2]}; else __ss_face=${part[1]}; fi
        __ss_visible "$__ss_face"; __ss_face_w=${#REPLY}
        __ss_visible "${__ss_at_tpl//@T@/00:00:00}"; __ss_at_w=${#REPLY}
    fi
    __ss_warn=

    # right prompt: jump there and back, invisible to readline's line length
    __ss_visible "$right"
    if ((${#REPLY} && __ss_bar_w + ${#REPLY} + 2 <= COLUMNS)); then
        bar="\[\e7\e[$((COLUMNS - ${#REPLY}))G$right\e8\]$bar"
    fi
    PS1="\[\e]0;bash in \W\a\]$head$bar"
}

# Enter (and C-j) snapshot the line, then accept it, in every keymap.
for __ss_km in emacs vi-insert vi-command; do
    bind -m "$__ss_km" -x '"\C-x\C-]s": __ss_snap'
    bind -m "$__ss_km" '"\C-x\C-]a": accept-line'
    bind -m "$__ss_km" '"\C-m": "\C-x\C-]s\C-x\C-]a"'
    bind -m "$__ss_km" '"\C-j": "\C-x\C-]s\C-x\C-]a"'
done 2>/dev/null
unset __ss_km

if [[ ${__bp_imported-} ]]; then   # bash-preexec owns PROMPT_COMMAND
    [[ " ${precmd_functions[*]} " == *' __ss_precmd '* ]] || precmd_functions+=(__ss_precmd)
elif [[ ${PROMPT_COMMAND[*]-} != *__ss_precmd* ]]; then
    __ss_user_pc=("${PROMPT_COMMAND[@]}")
    unset PROMPT_COMMAND
    PROMPT_COMMAND=__ss_precmd
fi

# PS0 expands in this shell but runs $(...) in a subshell: the arithmetic
# assignments carry its results back. Without a terminal that answers where
# its cursor is, the line can't be found again: Enter only starts the clock.
# shellcheck disable=SC2016  # PS0 is expanded by bash, at Enter
if [[ ${PS0-} == *__ss_t0* ]]; then
    :
elif [[ $TERM != dumb && -t 0 && -t 1 ]] && __ss_row >/dev/null; then
    PS0='${__ss_nil:$((__ss_t0=${EPOCHREALTIME//[!0-9]/}, __ss_ran=1, __ss_n=${#__ss_lines[@]}, __ss_cols=COLUMNS, __ss_rown=LINES, __ss_r1=$(__ss_ps0), 0)):0}'${PS0-}
else
    PS0='${__ss_nil:$((__ss_t0=${EPOCHREALTIME//[!0-9]/}, 0)):0}'${PS0-}
fi
__ss_config
PS2=$(starship prompt --continuation)
