#!/usr/bin/env python3
"""Run on the authorized ECS as root. Secrets are never printed."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

os.umask(0o077)
root = Path('/opt/classhub')
shared = root / 'shared'
shared.mkdir(parents=True, exist_ok=True)
(root / 'backups').mkdir(exist_ok=True)
(root / 'releases').mkdir(exist_ok=True)
private = shared / 'db-secrets.json'
if not private.exists():
    private.write_text(json.dumps({'adminUser': 'classhub_admin', 'adminPassword': secrets.token_hex(32),
        'appUser': 'classhub_app', 'appPassword': secrets.token_hex(32)}))
credentials = json.loads(private.read_text())
env = shared / 'mongo.env'
env.write_text('MONGO_INITDB_ROOT_USERNAME=' + credentials['adminUser'] + '\nMONGO_INITDB_ROOT_PASSWORD=' + credentials['adminPassword'] + '\nGLIBC_TUNABLES=glibc.pthread.rseq=1\n')
image = 'mongo:8.3.11'
result = subprocess.run(['docker', 'inspect', 'classhub-mongo', '--format', '{{.State.Status}}'], capture_output=True, text=True)
if result.returncode == 0:
    existing = json.loads(subprocess.check_output(['docker', 'inspect', 'classhub-mongo']))[0]
    if existing['Config']['Image'] != image or 'GLIBC_TUNABLES=glibc.pthread.rseq=1' not in existing['Config']['Env']:
        raise SystemExit('Existing container configuration differs; review it before replacement.')
else:
    subprocess.run(['docker', 'run', '-d', '--name', 'classhub-mongo', '--restart', 'unless-stopped',
    '-p', '127.0.0.1:27017:27017', '-v', 'classhub-mongo-data:/data/db',
    '--env-file', str(env), '--memory', '900m', '--memory-swap', '1200m',
    '--log-opt', 'max-size=10m', '--log-opt', 'max-file=3', image,
        '--auth', '--wiredTigerCacheSizeGB', '0.3', '--bind_ip_all'], check=True)
auth = 'const authentication=db.getSiblingDB("admin").auth(process.env.MONGO_INITDB_ROOT_USERNAME,process.env.MONGO_INITDB_ROOT_PASSWORD); if(authentication!==1 && authentication?.ok!==1)quit(1);\n'
for attempt in range(60):
    ready = subprocess.run(['docker', 'exec', 'classhub-mongo', 'mongosh', '--quiet', 'admin', '--eval',
        auth + 'if(db.runCommand({ping:1}).ok!==1)quit(1);\n'], text=True, capture_output=True)
    if ready.returncode == 0:
        break
    time.sleep(2)
else:
    raise SystemExit('MongoDB readiness failed; inspect docker logs without deleting data.')
js = auth + 'const appdb=db.getSiblingDB("uniclub");\n'
js += 'if(!appdb.getUser(' + json.dumps(credentials['appUser']) + ')) appdb.createUser({user:' + json.dumps(credentials['appUser']) + ',pwd:' + json.dumps(credentials['appPassword']) + ',roles:[{role:"readWrite",db:"uniclub"}]});\n'
js += 'const s=db.serverStatus();print(JSON.stringify({version:s.version,allocator:s.tcmalloc?.usingPerCpuCache,uptime:s.uptime}));\n'
result = subprocess.run(['docker','exec','-i','classhub-mongo','mongosh','--quiet','admin','--file','/dev/stdin'], input=js, text=True, capture_output=True)
if result.returncode or 'Error' in result.stdout:
    raise SystemExit('MongoDB application user setup failed.')
uri = 'mongodb://' + credentials['appUser'] + ':' + credentials['appPassword'] + '@127.0.0.1:27017/uniclub?authSource=uniclub'
base = (shared / 'backend-base.env').read_text()
(shared / 'backend.env').write_text(base.rstrip() + '\nMONGODB_URI=' + uri + '\n')
subprocess.run(['chown', 'classhub:classhub', str(shared / 'backend.env')], check=True)
print('MongoDB ready; application credentials saved privately.')
