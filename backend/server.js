require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { UPLOAD_BASE } = require("./storage");

const app = express();
app.set("trust proxy", true);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    "https://schuetzenhub-aws.vercel.app",
    "http://localhost:8080",
    "http://localhost:5173"
  ],
  credentials: true,
}));
app.use(express.json({ limit: "20mb" }));

// Statische Datei-Auslieferung (lokaler Modus)
// Auf AWS: Diese Route entfällt – Dateien kommen direkt von S3/CloudFront
if (process.env.USE_S3 !== "true") {
  app.use("/uploads", express.static(UPLOAD_BASE));
}

// ─── Routen ───────────────────────────────────────────────────────────────────

app.use("/api/auth", require("./routes/auth"));
app.use("/api/account", require("./routes/account"));
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/members", require("./routes/members"));
app.use("/api/events", require("./routes/events"));
app.use("/api/festplaner", require("./routes/festplaner"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/rpc", require("./routes/rpc"));
app.use("/api/functions", require("./routes/rpc"));
app.use("/api", require("./routes/api"));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route nicht gefunden" });
});

// Fehler-Handler
app.use((err, req, res, next) => {
  console.error("Unbehandelter Fehler:", err);
  res.status(500).json({ error: "Interner Serverfehler" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend läuft auf http://localhost:${PORT}`);
  console.log(`   Datenbank: ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || "schuetzenhub"}`);
  const storageProvider =
    process.env.STORAGE_PROVIDER === "supabase" ||
    process.env.USE_SUPABASE_STORAGE === "true" ||
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? "Supabase Storage"
      : `Lokal (${UPLOAD_BASE})`;
  console.log(`   Speicher:  ${storageProvider}`);
});
