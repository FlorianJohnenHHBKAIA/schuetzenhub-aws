/**
 * Dev-Seed: Legt Testbenutzer für die lokale Entwicklungsumgebung an.
 *
 * Ausführen: npm run seed  (aus dem backend/-Verzeichnis)
 *         oder: node scripts/seed-dev.js
 *
 * Sicher wiederholbar – bestehende Benutzer werden nicht verändert.
 */

require("dotenv").config();
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");

const BCRYPT_ROUNDS = 12;

const DEV_USERS = [
  {
    email: "superadmin@test.de",
    password: "test1234",
    isSuperAdmin: true,
    label: "Superadmin",
  },
];

async function seedUser({ email, password, isSuperAdmin, label }) {
  const existing = await pool.query(
    "SELECT id, is_superadmin FROM auth_users WHERE email = $1",
    [email.toLowerCase().trim()]
  );

  if (existing.rows[0]) {
    console.log(`  ⏭  ${label} (${email}) existiert bereits – übersprungen`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = uuidv4();

  await pool.query(
    `INSERT INTO auth_users (id, email, password_hash, is_superadmin)
     VALUES ($1, $2, $3, $4)`,
    [id, email.toLowerCase().trim(), passwordHash, isSuperAdmin]
  );

  console.log(`  ✅  ${label} (${email}) angelegt – is_superadmin: ${isSuperAdmin}`);
}

async function main() {
  console.log("\n🌱 Dev-Seed gestartet …\n");
  try {
    for (const user of DEV_USERS) {
      await seedUser(user);
    }
    console.log("\n✔  Seed abgeschlossen.\n");
  } catch (err) {
    console.error("\n✗  Seed-Fehler:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
