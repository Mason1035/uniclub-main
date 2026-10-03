#!/usr/bin/env bash
set -euo pipefail
umask 077
stamp=$(date +%Y%m%d-%H%M%S)
directory=/opt/classhub/backups/$stamp
mkdir -m 700 "$directory"
docker exec classhub-mongo sh -c 'exec mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db uniclub --archive --gzip' > "$directory/uniclub.archive.gz.partial"
mv "$directory/uniclub.archive.gz.partial" "$directory/uniclub.archive.gz"
tar -czf "$directory/shared.tar.gz" -C /opt/classhub shared
readlink -f /opt/classhub/current > "$directory/release.txt"
printf 'Backup complete: %s\n' "$directory"
