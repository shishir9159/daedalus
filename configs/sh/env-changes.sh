#!/bin/sh
# Prints what env.sh adds or changes, as NUL-terminated NAME=value, for the
# shells that can't source it (configs/fish, configs/nushell). GNU env and awk.
{
    env -0
    printf '\0'
    # shellcheck source=env.sh
    . "$(dirname "$0")/env.sh"
    env -0
} | awk 'BEGIN { RS = ORS = "\0" } $0 == "" { new = 1; next } !new { old[$0]; next } !($0 in old)'
