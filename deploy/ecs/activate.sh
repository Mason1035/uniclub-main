#!/usr/bin/env bash
set -euo pipefail
umask 022
archive=${1:?Supply the release archive}
release_id=${2:?Supply a unique release name}
[[ "$release_id" =~ ^[0-9]{8}-[0-9]{6}$ ]] || { printf 'Invalid release name\n'; exit 1; }
release=/opt/classhub/releases/$release_id
[[ ! -e "$release" ]] || { printf 'Release already exists\n'; exit 1; }
mkdir "$release"
tar --no-same-owner --warning=no-unknown-keyword -xzf "$archive" -C "$release"
test -f "$release/dist/index.html"
# A release must include the public-only documents and private SPA shell before
# its routing rules are installed. Never expose a partial SEO build.
for document in privacy.html about.html app.html 404.html robots.txt sitemap.xml; do
    test -f "$release/dist/$document"
done
# Public build assets must be readable by the Nginx worker.
chmod -R a+rX "$release/dist"
test -f "$release/uniclub-backend/package-lock.json"
node - "$release" <<'JS'
const fs = require('node:fs'), path = require('node:path');
const release = process.argv[2];
const html = fs.readFileSync(path.join(release, 'dist/index.html'), 'utf8');
const entries = [...html.matchAll(/(?:src|href)="(\/(?:static|assets)\/[^"?]+)"/g)];
if (!entries.length || entries.some(([, file]) => !fs.existsSync(path.join(release, 'dist', file)))) {
    throw new Error('Release contains missing frontend entry files; check filename case.');
}
JS
# Ensure the non-root API can write media in the persistent shared directory.
install -d -m 750 -o classhub -g classhub /opt/classhub/shared/uploads /opt/classhub/shared/uploads/social
mkdir -p "$release/uniclub-backend/public"
ln -s /opt/classhub/shared/uploads "$release/uniclub-backend/public/uploads"
cd "$release/uniclub-backend"
NODE_OPTIONS=--max-old-space-size=512 npm ci --omit=dev --no-audit --no-fund > "$release/install.log" 2>&1
# Patch the managed upload/static performance/SEO settings; preserve certificates,
# domains and API access. Validate before reload and restore on any failure.
nginx_site=/etc/nginx/sites-enabled/classhub
if [[ -f "$nginx_site" ]]; then
    nginx_site=$(readlink -f "$nginx_site")
    candidate=$(mktemp)
    node "$release/deploy/ecs/update-social-upload-nginx.cjs" "$nginx_site" "$candidate"
    performance_candidate=$(mktemp)
    performance_options=()
    if [[ "$(nginx -V 2>&1)" != *--with-http_v2_module* ]]; then
        performance_options+=(--no-http2)
        printf 'HTTP/2 module unavailable; applying gzip/cache improvements only.\n'
    fi
    node "$release/deploy/ecs/update-performance-nginx.cjs" "$candidate" "$performance_candidate" "${performance_options[@]}"
    mv "$performance_candidate" "$candidate"
    seo_candidate=$(mktemp)
    node "$release/deploy/ecs/update-seo-nginx.cjs" "$candidate" "$seo_candidate"
    mv "$seo_candidate" "$candidate"
    if ! cmp -s "$nginx_site" "$candidate"; then
        nginx_backup="$nginx_site.bak-classhub-$release_id"
        cp -p "$nginx_site" "$nginx_backup"
        cat "$candidate" > "$nginx_site"
        if ! nginx -t || ! systemctl reload nginx; then
            cat "$nginx_backup" > "$nginx_site"
            nginx -t && systemctl reload nginx || true
            rm -f "$candidate"
            printf 'ClassHub Nginx update failed; original config restored.\n'
            exit 1
        fi
    fi
    rm -f "$candidate"
else
    printf 'ClassHub Nginx site not found; apply the managed upload/cache/SEO settings from the template manually.\n' >&2
fi
old=$(readlink -f /opt/classhub/current || true)
if [[ -n "$old" && -d "$old" ]]; then
    /opt/classhub/current/deploy/ecs/backup.sh
    ln -sfn "$old" /opt/classhub/previous
fi
ln -s "$release" /opt/classhub/current.next
mv -Tf /opt/classhub/current.next /opt/classhub/current
install -m 644 "$release/deploy/ecs/classhub.service" /etc/systemd/system/classhub.service
systemctl daemon-reload
systemctl enable classhub
systemctl restart classhub
ready=false
for attempt in {1..30}; do
    if curl --noproxy '*' --fail --silent http://127.0.0.1:5050/api/health > /dev/null; then ready=true; break; fi
    sleep 2
done
if [[ "$ready" != true ]]; then
    if [[ -n "$old" && -d "$old" ]]; then ln -sfn "$old" /opt/classhub/current; systemctl restart classhub; fi
    printf 'API health failed; previous release restored when available.\n'
    exit 1
fi
printf 'Release ready: %s\n' "$release_id"
