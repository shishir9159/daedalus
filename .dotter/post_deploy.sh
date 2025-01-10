#!/bin/sh
# dotter runs this after every deploy, from the repo root. It renders this
# file as a template first: keep double braces out of it.
exec bash configs/sh/deploy.sh
