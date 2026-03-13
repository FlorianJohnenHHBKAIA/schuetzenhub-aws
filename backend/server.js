require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { UPLOAD_BASE } = require("./storage");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || ["http://localhost:8080", "http://localhost:5173"],
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
app.use("/api/members", require("./routes/members"));
app.use("/api/events", require("./routes/events"));
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
  console.log(`   Speicher:  ${process.env.USE_S3 === "true" ? "AWS S3 (" + process.env.AWS_S3_BUCKET + ")" : "Lokal (" + UPLOAD_BASE + ")"}`);
});