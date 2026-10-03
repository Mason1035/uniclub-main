// Generates the AES master key locally without printing it or touching MongoDB.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
// An explicit path supports the ECS systemd EnvironmentFile outside releases.
const target = process.argv[2];
const file = target ? path.resolve(target) : path.join(__dirname, '..', '.env');
const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const existing = target ? dotenv.parse(previous).AI_SECRET_ENCRYPTION_KEY : process.env.AI_SECRET_ENCRYPTION_KEY || dotenv.parse(previous).AI_SECRET_ENCRYPTION_KEY;
if (existing) {
  const buffer = Buffer.from(existing, 'base64');
  if (buffer.length !== 32 || buffer.toString('base64') !== existing) {
    process.stderr.write('AI_SECRET_ENCRYPTION_KEY 已存在但格式不正确；请检查现有配置，脚本不会覆盖它。\n');
    process.exitCode = 1;
  } else {
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
    process.stdout.write('AI 主加密密钥已配置，无需修改。\n');
  }
} else {
  const line = `AI_SECRET_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`;
  const next = /^AI_SECRET_ENCRYPTION_KEY\s*=.*$/m.test(previous)
    ? previous.replace(/^AI_SECRET_ENCRYPTION_KEY\s*=.*$/m, line)
    : `${previous.trimEnd()}\n\n# ClassHub admin AI encryption master key (private)\n${line}\n`;
  fs.writeFileSync(file, next, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  process.stdout.write('AI 主加密密钥已写入配置文件（权限 600）；请重启后端生效。\n');
}
