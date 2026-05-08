const { Pool } = require('pg');
const env = require('../config/env');

const connectionString = env.NODE_ENV === 'test'
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

const pool = new Pool({ connectionString });

module.exports = pool;
