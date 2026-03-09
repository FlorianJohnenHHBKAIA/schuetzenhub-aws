const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "schuetzenhub",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  // Für AWS RDS später: ssl: { rejectUnauthorized: false }
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unerwarteter Datenbankfehler:", err);
});

module.exports = pool;
