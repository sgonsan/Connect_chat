const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const url = process.env.MIGRATE_TEST === '1'
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

async function migrate() {
  const pool = new Pool({ connectionString: url });
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log('Migrations complete.');
}

migrate().catch((err) => { console.error(err); process.exit(1); });
