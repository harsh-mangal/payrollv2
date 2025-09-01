// server/index.js
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";

import clientRoutes from "./routes/clients.js";
import invoiceRoutes from "./routes/invoices.js";
import paymentRoutes from "./routes/payments.js";
import shareRoutes from "./routes/share.js";
import staffRoutes from "./routes/staff.js"; // <-- NEW
import expenseRoutes from "./routes/expenses.js";
import reportRoutes from "./routes/reports.js";
import authRoutes from "./routes/auth.js";
import requireAuth from "./middleware/requireAuth.js";
const app = express();

// CORS & parsers
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Ensure uploads dir exists
const UP = path.resolve("uploads");
if (!fs.existsSync(UP)) fs.mkdirSync(UP, { recursive: true });

// Static files (serves invoice PDFs and salary slips)
app.use("/uploads", express.static(UP));

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// API routes
// Public
app.use("/api", authRoutes);

// Protect your business APIs (recommended)
app.use("/api/clients", requireAuth, clientRoutes);
app.use("/api/invoices", requireAuth, invoiceRoutes);
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/share", requireAuth, shareRoutes);
app.use("/api", requireAuth, staffRoutes);
app.use("/api/expenses", requireAuth, expenseRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
// Basic 404 for unknown API paths
app.use("/api", (_req, res) =>
  res.status(404).json({ ok: false, error: "NOT_FOUND" })
);

// Basic error handler
// (If you already have one, keep yours.)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
});

const PORT = process.env.PORT || 3018;
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MONGO_URL missing in env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URL)
  .then(() => {
    app.listen(PORT, () => console.log("✅ Server listening on", PORT));
  })
  .catch((e) => {
    console.error("❌ Mongo connect error:", e.message);
    process.exit(1);
  });
