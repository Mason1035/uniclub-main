#!/usr/bin/env node
/**
 * 启动本机 MongoDB（开发用）。
 *
 * 为什么单独写一个脚本：
 *   1. mongod 不在 PATH 里（Homebrew 装了但没 link）；
 *   2. 数据目录不是 Homebrew 默认的 /opt/homebrew/var/mongodb（那个是空的），
 *      本机实际数据在 ~/data/db；
 *   3. macOS 不支持 `mongod --fork`，所以必须占一个终端窗口。
 *
 * 用法：npm run mongo        （Ctrl+C 停止）
 * 可用环境变量覆盖：MONGOD_BIN、MONGODB_DBPATH、MONGODB_PORT
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.MONGOD_BIN,
  '/opt/homebrew/opt/mongodb-community/bin/mongod',
  '/opt/homebrew/opt/mongodb-community@8.3/bin/mongod',
  '/usr/local/opt/mongodb-community/bin/mongod',
  'mongod',
].filter(Boolean);

const binary = CANDIDATES.find((candidate) => candidate === 'mongod' || fs.existsSync(candidate));
if (!binary) {
  console.error('❌ 找不到 mongod。请先安装：brew install mongodb-community');
  console.error('   或用 MONGOD_BIN=/path/to/mongod npm run mongo 指定路径。');
  process.exit(1);
}

const dbPath = process.env.MONGODB_DBPATH || path.join(os.homedir(), 'data', 'db');
const port = process.env.MONGODB_PORT || '27017';

try {
  fs.mkdirSync(dbPath, { recursive: true });
} catch (error) {
  console.error(`❌ 无法创建数据目录 ${dbPath}:`, error.message);
  process.exit(1);
}

console.log('启动 MongoDB');
console.log(`  二进制   : ${binary}`);
console.log(`  数据目录 : ${dbPath}`);
console.log(`  端口     : ${port}`);
console.log('  停止     : Ctrl+C\n');

const child = spawn(binary, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', port], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error('❌ 启动失败:', error.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
