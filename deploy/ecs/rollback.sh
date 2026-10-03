#!/usr/bin/env bash
set -euo pipefail
[[ -L /opt/classhub/previous ]] || { printf 'No previous validated release is available yet.\n'; exit 1; }
previous=$(readlink -f /opt/classhub/previous)
current=$(readlink -f /opt/classhub/current)
test -f "$previous/dist/index.html"
ln -sfn "$previous" /opt/classhub/current
systemctl restart classhub
if ! curl --noproxy '*' --retry 10 --retry-connrefused --retry-delay 2 --fail --silent http://127.0.0.1:5050/api/health; then
    ln -sfn "$current" /opt/classhub/current
    systemctl restart classhub
    exit 1
fi
ln -sfn "$current" /opt/classhub/previous
printf '\nRestored release: %s\n' "$previous"
