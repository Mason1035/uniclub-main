#!/usr/bin/env node
/**
 * createAdmin.js - non-interactive, idempotent admin bootstrap for ClassHub.
 *
 * Reads its input from environment variables so it can be scripted / repeated:
 *
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_NAME="Class Admin" \
 *   ADMIN_PASSWORD="********" \
 *   node scripts/createAdmin.js
 *
 * Optional:
 *   ADMIN_UNIQUE_ID       - explicit member ID (defaults to ADMIN-<slug of email>)
 *   ADMIN_UPDATE_PASSWORD - set to "true" to also reset the password of an existing user
 *
 * Behaviour:
 *   - user exists  -> isAdmin = true (never creates a duplicate)
 *   - user missing -> creates the user with a bcrypt-hashed password and isAdmin = true
 *
 * Never prints the password or the password hash.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const exitWithError = (message) => {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

/** Find the first free uniqueId based on the requested base value. */
const resolveUniqueId = async (base) => {
  let candidate = base;
  let counter = 1;
  // The User model enforces uniqueId uniqueness, but we check explicitly so the
  // script gives a deterministic result instead of a duplicate-key error.
  while (await User.exists({ uniqueId: candidate })) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  return candidate;
};

const main = async () => {
  const rawEmail = (process.env.ADMIN_EMAIL || '').trim();
  const name = (process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const explicitUniqueId = (process.env.ADMIN_UNIQUE_ID || '').trim();
  const updatePassword = String(process.env.ADMIN_UPDATE_PASSWORD || '').toLowerCase() === 'true';

  if (!rawEmail) exitWithError('ADMIN_EMAIL is required.');
  if (!password) exitWithError('ADMIN_PASSWORD is required.');
  // Mirrors the User model validator, so an invalid address fails fast with a
  // readable message instead of a Mongoose ValidationError.
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(rawEmail)) {
    exitWithError(
      `ADMIN_EMAIL "${rawEmail}" is not a valid email address for the User model (e.g. admin@classhub.dev).`
    );
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) exitWithError('MONGODB_URI is not set (check uniclub-backend/.env).');

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`✅ Connected (database: ${mongoose.connection.db?.databaseName || 'unknown'})\n`);

  try {
    // Case-insensitive lookup so an existing account is always found, whatever
    // the original casing in the database was.
    const existing = await User.findOne({ email: new RegExp(`^${escapeRegex(rawEmail)}$`, 'i') });

    let action;
    let user;

    if (existing) {
      existing.isAdmin = true;
      if (updatePassword) {
        existing.passwordHash = await bcrypt.hash(password, 10);
        existing.tokenVersion = (existing.tokenVersion || 0) + 1;
      }
      user = await existing.save();
      action = 'updated';
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      const uniqueIdBase = explicitUniqueId || `ADMIN-${slugify(rawEmail.split('@')[0]) || 'USER'}`;
      const uniqueId = await resolveUniqueId(uniqueIdBase);

      user = await User.create({
        email: rawEmail,
        name: name || rawEmail.split('@')[0],
        uniqueId,
        passwordHash,
        isEnrolled: true,
        isVerified: true,
        isAdmin: true,
      });
      action = 'created';
    }

    console.log('──────────────────────────────────────');
    console.log(`status   : ${action}`);
    console.log(`email    : ${user.email}`);
    console.log(`name     : ${user.name}`);
    console.log(`uniqueId : ${user.uniqueId}`);
    console.log(`isAdmin  : ${user.isAdmin === true}`);
    if (existing && !updatePassword) {
      console.log('password : unchanged (set ADMIN_UPDATE_PASSWORD=true to reset it)');
    }
    console.log('──────────────────────────────────────\n');
  } finally {
    await mongoose.connection.close();
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Failed to create/update the admin user:', error.message);
    process.exit(1);
  });
