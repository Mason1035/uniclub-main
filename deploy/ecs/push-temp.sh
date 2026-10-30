#!/usr/bin/env bash
set -euo pipefail
project=$(cd "$(dirname "$0")/../.." && pwd)
host=${CLASSHUB_SSH_HOST:-root@47.95.157.51}
key=${CLASSHUB_SSH_KEY:-/Users/alexmason/Documents/Codex/.classhub-ssh/id_ed25519}
stamp=$(date +%Y%m%d-%H%M%S)
ssh_options=(-i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes)
cd "$project"
npm run temp:build
chmod -R a+rX dist-temp
ssh "${ssh_options[@]}" "$host" "mkdir -p /opt/classhub/temp/releases/$stamp/temp"
scp -r "${ssh_options[@]}" dist-temp/. "$host:/opt/classhub/temp/releases/$stamp/temp/"
scp "${ssh_options[@]}" deploy/ecs/temp-location.conf deploy/ecs/activate-temp.cjs "$host:/opt/classhub/temp/releases/$stamp/"
ssh "${ssh_options[@]}" "$host" "node /opt/classhub/temp/releases/$stamp/activate-temp.cjs $stamp"
ssh "${ssh_options[@]}" "$host" 'curl --noproxy "*" --fail --silent --resolve csrg3b.top:443:127.0.0.1 https://csrg3b.top/temp/ | head -c 300'
