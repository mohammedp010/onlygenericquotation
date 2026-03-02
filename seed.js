/**
 * seed.js — Run once after schema.sql to create the default admin user.
 * Usage:  node seed.js
 */

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const connection = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'onlygeneric',
  });

  try {
    const SEED_USERNAME = 'admin';
    const SEED_PASSWORD = 'onlygeneric123';

    const hash = await bcrypt.hash(SEED_PASSWORD, 10);

    await connection.execute(
      `INSERT INTO users (username, password_hash)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [SEED_USERNAME, hash]
    );

    console.log(`✅  Default user seeded successfully.`);
    console.log(`    Username : ${SEED_USERNAME}`);
    console.log(`    Password : ${SEED_PASSWORD}`);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
