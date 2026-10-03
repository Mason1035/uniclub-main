#!/usr/bin/env bash
# Run on the development Mac from any directory.
set -euo pipefail
project=$(cd "$(dirname "$0")/../.." && pwd)
host=${CLASSHUB_SSH_HOST:-root@47.95.157.51}
key=${CLASSHUB_SSH_KEY:-/Users/alexmason/Documents/Codex/.classhub-ssh/id_ed25519}
stamp=$(date +%Y%m%d-%H%M%S)
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT
ssh_options=(-i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes)
cd "$project"
VITE_API_URL='' npm run build
chmod -R a+rX dist
COPYFILE_DISABLE=1 tar --no-xattrs --exclude=node_modules --exclude='.env*' --exclude='.quantification-storage.json*' --exclude=uniclub-backend/public/uploads --exclude=.DS_Store -czf "$temporary/classhub.tar.gz" dist uniclub-backend shared scripts deploy package.json
scp "${ssh_options[@]}" "$temporary/classhub.tar.gz" "$host:/opt/classhub/classhub-$stamp.tar.gz"
scp "${ssh_options[@]}" deploy/ecs/activate.sh "$host:/opt/classhub/activate.sh"
ssh "${ssh_options[@]}" "$host" "bash /opt/classhub/activate.sh /opt/classhub/classhub-$stamp.tar.gz $stamp"
ssh "${ssh_options[@]}" "$host" 'curl --noproxy "*" --fail --silent http://127.0.0.1:5050/api/health'
