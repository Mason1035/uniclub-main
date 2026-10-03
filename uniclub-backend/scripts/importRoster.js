#!/usr/bin/env node
/** Import student IDs and names, provisioning only missing accounts. */
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const RosterService = require('../services/RosterService');
const { parseRosterText, validateEntries } = require('../utils/rosterPolicy');
const { prepareStudentLogin } = require('./prepareStudentLogin');

function readRoster(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = path.extname(filePath).toLowerCase() === '.json' ? JSON.parse(raw) : parseRosterText(raw);
  return validateEntries(rows);
}

async function main(args = process.argv.slice(2)) {
  const dryRun = args.includes('--dry-run');
  const filePath = args.find(arg => !arg.startsWith('--'));
  if (!filePath || args.some(arg => arg.startsWith('--') && arg !== '--dry-run')) {
    throw new Error('用法：node scripts/importRoster.js <名单.csv|.tsv|.json> [--dry-run]');
  }
  const entries = readRoster(path.resolve(filePath));
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI 未配置。');
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    // A dry run does not create accounts, update records or alter indexes.
    if (!dryRun) await prepareStudentLogin(mongoose.connection.db);
    const result = await new RosterService().import(entries, { dryRun });
    console.log(JSON.stringify({ dryRun, rows: entries.length, ...result }));
    if (result.failed) process.exitCode = 1;
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  // Never log account IDs, password hashes or connection strings.
  console.error(error.status ? error.message : '导入未完成，请检查名单文件和本地数据库连接。');
  process.exitCode = 1;
});
module.exports = { readRoster, main };
