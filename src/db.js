"use strict";

const { Pool } = require("pg");

/**
 * Crea un pool leggendo:
 * - DB_URL oppure DATABASE_URL
 * - altrimenti PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD
 *
 * Nota: non c'entra nulla con i cookie. Cookie = livello HTTP (gateway).
 * Questo file è solo DB.
 */
function createPool(opts = {}) {
  const url = process.env.DB_URL || process.env.DATABASE_URL;

  const base = {
    connectionTimeoutMillis: 5000,
    ...opts
  };

  if (url) {
    return new Pool({ ...base, connectionString: url });
  }

  const missing = [];
  for (const k of ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
    if (!process.env[k]) missing.push(k);
  }
  if (missing.length) {
    throw new Error(
      `Missing DB config. Provide DB_URL/DATABASE_URL or set: ${missing.join(", ")}`
    );
  }

  return new Pool({
    ...base,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
  });
}

// pool singleton (comodo)
const pool = createPool();

async function q(text, params) {
  return pool.query(text, params);
}

module.exports = { createPool, pool, q };
