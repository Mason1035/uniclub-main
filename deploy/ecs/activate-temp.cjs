// Activate only the independently built /temp exhibition. Run on the existing ECS.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const stamp = process.argv[2];
if (!/^\d{8}-\d{6}$/.test(stamp || '')) throw new Error('Expected a deployment timestamp');
const base = '/opt/classhub/temp';
const release = path.join(base, 'releases', stamp);
const current = path.join(base, 'current');
const config = '/etc/nginx/sites-available/classhub';
const snippet = '/etc/nginx/snippets/classhub-temp.conf';
const include = '    include /etc/nginx/snippets/classhub-temp.conf;';
if (!fs.existsSync(path.join(release, 'temp/index.html'))) throw new Error('Exhibition HTML is missing');
const original = fs.readFileSync(config, 'utf8');
const priorTarget = fs.existsSync(current) ? fs.realpathSync(current) : null;
const priorSnippet = fs.existsSync(snippet) ? fs.readFileSync(snippet) : null;
const sourceSnippet = fs.readFileSync(path.join(release, 'temp-location.conf'));
let next = original;
if (!original.includes(include.trim())) {
  const domain = original.indexOf('server_name csrg3b.top;');
  if (domain < 0) throw new Error('Expected csrg3b.top server was not found');
  const root = original.indexOf('    root /opt/classhub/current/dist;', domain);
  const followingServer = original.indexOf('\nserver {', domain);
  if (root < 0 || (followingServer >= 0 && root > followingServer)) throw new Error('Expected application root was not found');
  const insert = original.indexOf('\n', root) + 1;
  next = original.slice(0, insert) + include + '\n' + original.slice(insert);
}
fs.copyFileSync(config, `${config}.before-temp-${stamp}`);
fs.mkdirSync(path.dirname(snippet), { recursive: true });
fs.writeFileSync(snippet, sourceSnippet);
const pending = `${current}.next-${stamp}`;
fs.symlinkSync(release, pending);
fs.renameSync(pending, current);
fs.writeFileSync(config, next);
try {
  execFileSync('nginx', ['-t'], { stdio: 'inherit' });
  execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'inherit' });
} catch (error) {
  fs.writeFileSync(config, original);
  if (priorSnippet) fs.writeFileSync(snippet, priorSnippet); else fs.unlinkSync(snippet);
  if (priorTarget) {
    const restore = `${current}.restore-${stamp}`;
    fs.symlinkSync(priorTarget, restore); fs.renameSync(restore, current);
  } else fs.unlinkSync(current);
  throw error;
}
console.log(`Temporary exhibition activated: /temp/ (${stamp})`);
