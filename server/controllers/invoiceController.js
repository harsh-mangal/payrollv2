// server/controllers/invoiceController.js
import fs from "fs";
import path from "path";
import Client from "../models/Client.js";
import Invoice from "../models/Invoice.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { nextInvoiceNo } from "../utils/invoiceNumber.js";
import { round2 } from "../utils/money.js";
import { generateInvoicePDF } from "../utils/pdf.js";
import { getCurrentBalance } from "../utils/balance.js";

const ensureUploadsDir = () => {
  const dir = path.resolve("uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// ---------- CREATE INVOICE ----------
export const createInvoice = async (req, res) => {
  try {
    const {
      clientId,
      issueDate,
      periodStart,
      periodEnd,
      billingType = "ONE_TIME", // NEW
      lineItems = [],
      extraAmount = 0,
      remarks,
      gstMode = "EXCLUSIVE",
      gstRate: gstRateOverride,
    } = req.body;

    // ---- Validate client ----
    const client = await Client.findById(clientId);
    if (!client)
      return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "LINE_ITEMS_REQUIRED" });
    }

    const invoiceNo = await nextInvoiceNo();
    const defaultGst = Number(process.env.GST_RATE || 0.18);
    const toNum = (v) => Number(v || 0);

    const gstRate =
      gstMode === "NOGST" ? 0 : Number(gstRateOverride ?? defaultGst);

    // ---- Totals ----
    const sumExclusive = lineItems.reduce((s, it) => {
      if (gstMode === "INCLUSIVE") return s;
      return s + toNum(it.amountExclGst);
    }, 0);

    const sumInclusive = lineItems.reduce((s, it) => {
      if (gstMode !== "INCLUSIVE") return s;
      return s + toNum(it.amountInclGst);
    }, 0);

    const extra = toNum(extraAmount);

    let subtotalExclGst, gstAmount, totalInclGst;

    if (gstMode === "EXCLUSIVE") {
      subtotalExclGst = round2(sumExclusive + extra);
      gstAmount = round2(subtotalExclGst * gstRate);
      totalInclGst = round2(subtotalExclGst + gstAmount);
    } else if (gstMode === "INCLUSIVE") {
      const gross = round2(sumInclusive + extra);
      const divisor = 1 + gstRate;
      const base = gstRate > 0 ? round2(gross / divisor) : gross;
      subtotalExclGst = base;
      gstAmount = round2(gross - base);
      totalInclGst = gross;
    } else {
      // NOGST
      subtotalExclGst = round2(sumExclusive + extra);
      gstAmount = 0;
      totalInclGst = subtotalExclGst;
    }

    // ---- Create invoice ----
    const invoice = await Invoice.create({
      clientId,
      invoiceNo,
      billingType, // NEW
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      lineItems,
      extraAmount: extra,
      remarks,
      gstMode,
      subtotalExclGst,
      gstRate,
      gstAmount,
      totalInclGst,
      paidAmount: 0,
      pendingAmount: totalInclGst,
      status: "DUE",
    });

    // ---- Ledger entry (debit) ----
    const prevBal = await getCurrentBalance(clientId);
    const afterInvoiceBal = round2(prevBal + totalInclGst);

    await LedgerEntry.create({
      clientId,
      date: new Date(),
      type: "DEBIT",
      amount: totalInclGst,
      balanceAfter: afterInvoiceBal,
      refType: "INVOICE",
      refId: invoice._id,
      remarks: `Invoice ${invoice.invoiceNo}`,
    });

    // ---- Auto-adjust advance ----
    const availableAdvance = prevBal < 0 ? round2(-prevBal) : 0;
    if (availableAdvance > 0) {
      const apply = Math.min(availableAdvance, totalInclGst);
      if (apply > 0) {
        invoice.paidAmount = round2(invoice.paidAmount + apply);
        invoice.pendingAmount = round2(
          invoice.totalInclGst - invoice.paidAmount
        );
        invoice.status =
          invoice.pendingAmount <= 0
            ? "PAID"
            : invoice.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "DUE";
        await invoice.save();

        const afterAdjustBal = round2(afterInvoiceBal - apply);
        await LedgerEntry.create({
          clientId,
          date: new Date(),
          type: "CREDIT",
          amount: apply,
          balanceAfter: afterAdjustBal,
          refType: "ADJUSTMENT",
          refId: invoice._id,
          remarks: `Advance adjusted against ${invoice.invoiceNo}`,
        });
      }
    }

    // ---- PDF ----
    ensureUploadsDir();
    const outPath = path.resolve("uploads", `${invoice.invoiceNo}.pdf`);
    await generateInvoicePDF({ invoice, client, payments: [] }, outPath);
    invoice.pdfPath = outPath;
    await invoice.save();

    const pdfUrl = `${process.env.BASE_URL}/uploads/${path.basename(outPath)}`;

    res.json({ ok: true, invoice, pdfUrl });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};


// ---------- GET INVOICE PDF URL ----------
export const getInvoicePdf = async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    if (!inv.pdfPath) return res.status(404).json({ ok: false, error: 'PDF_NOT_READY' });
    return res.json({
      ok: true,
      url: `${process.env.BASE_URL}/uploads/${path.basename(inv.pdfPath)}`
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
};


