#!/usr/bin/env node
const path = require('node:path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Only an existing administrator is eligible. Updating tokenVersion revokes all
// JWTs issued before the password change, including legacy tokens without it.
async function rotateAdminPassword(email, password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('新密码至少需要 12 位');
  }
  const account = await User.findOne({ email: email.trim().toLowerCase(), isAdmin: true });
  if (!account) throw new Error('未找到该管理员账号');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(
    { _id: account._id, isAdmin: true, passwordHash: account.passwordHash },
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } }
  );
  if (result.modifiedCount !== 1) throw new Error('密码未更新，请检查管理员账号状态');
}

function hiddenPrompt(label) {
  if (!process.stdin.isTTY) throw new Error('请在终端运行此命令；密码不会显示或进入命令历史');
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (err) => {
      process.stdin.removeListener('data', read);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (err) reject(err); else resolve(value);
    };
    const read = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return finish(new Error('已取消'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdin.on('data', read);
  });
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const email = process.argv[2];
  if (!email || !email.includes('@')) throw new Error('用法：npm run admin:password -- 管理员邮箱');
  if (!process.env.MONGODB_URI) throw new Error('请先配置后端 MONGODB_URI');
  const password = await hiddenPrompt('新管理员密码（至少 12 位，不显示）：');
  const confirmation = await hiddenPrompt('再次输入：');
  if (password !== confirmation) throw new Error('两次密码不一致');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await rotateAdminPassword(email, password);
    console.log('管理员密码已更新，旧登录令牌已失效。');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exitCode = 1; });
module.exports = { rotateAdminPassword };
