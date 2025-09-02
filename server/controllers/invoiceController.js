// server/controllers/invoiceController.js
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
import Client from "../models/Client.js";
import Invoice from "../models/Invoice.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { nextInvoiceNo } from "../utils/invoiceNumber.js";
import { round2 } from "../utils/money.js";
import { generateInvoicePDF } from "../utils/pdf.js";
import { getCurrentBalance } from "../utils/balance.js";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

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
      billingType = "ONE_TIME",
      lineItems = [],
      extraAmount = 0,
      remarks,
      totalDays,
      gstMode = "EXCLUSIVE",
      gstRate: gstRateOverride,
    } = req.body;

    // ---- Validate client ----
    const client = await Client.findById(clientId);
    if (!client)
      return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ ok: false, error: "LINE_ITEMS_REQUIRED" });
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

    const transformedLineItems = lineItems.map((item) => ({
      description: item.description,
      unitPriceInclGst: item.amountInclGst || 0,
      unitPriceExclGst: item.amountExclGst || 0,
      qty: item.qty || undefined,
      originalAmount: item.originalAmount,
    }));

    // ---- Create invoice ----
    const invoice = await Invoice.create({
      clientId,
      invoiceNo,
      billingType,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      lineItems: transformedLineItems,
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
    await generateInvoicePDF(
      { invoice, totalDays, client, payments: [] },
      outPath
    );
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
    if (!inv) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!inv.pdfPath)
      return res.status(404).json({ ok: false, error: "PDF_NOT_READY" });
    return res.json({
      ok: true,
      url: `${process.env.BASE_URL}/uploads/${path.basename(inv.pdfPath)}`,
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
};

/* ----------------- Month-wise invoice from services ----------------- */

// overlap days within [monthStart, monthEnd]
function daysOverlapInMonth(serviceStart, serviceEnd, monthStart, monthEnd) {
  const sStart = dayjs(serviceStart);
  const sEnd = serviceEnd ? dayjs(serviceEnd) : null;

  const start = sStart.isAfter(monthStart) ? sStart : monthStart;
  const effEnd = sEnd && sEnd.isBefore(monthEnd) ? sEnd : monthEnd;

  const diff = effEnd.endOf("day").diff(start.startOf("day"), "day") + 1;
  return Math.max(0, diff);
}

// POST /invoices/from-services
export const createInvoiceFromServices = async (req, res) => {
  try {
    const {
      clientId,
      month, // 1..12
      year, // e.g. 2025
      issueDate, // optional
      gstMode = "EXCLUSIVE", // "EXCLUSIVE" | "INCLUSIVE" | "NOGST"
      remarks, // optional
      extraAmount = 0, // optional
    } = req.body;

    if (!clientId || !month || !year) {
      return res
        .status(400)
        .json({ ok: false, error: "CLIENTID_MONTH_YEAR_REQUIRED" });
    }

    const client = await Client.findById(clientId);
    if (!client)
      return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });

    const m = Number(month);
    const y = Number(year);
    const monthStart = dayjs(`${y}-${String(m).padStart(2, "0")}-01`).startOf(
      "day"
    );
    const monthEnd = monthStart.endOf("month");
    const daysInMonth = monthStart.daysInMonth();

    const lineItems = [];

    for (const s of client.services || []) {
      if (!s || !s.startDate) continue;

      const sStart = dayjs(s.startDate);
      const sEnd = s.expiryDate ? dayjs(s.expiryDate) : null;

      // active if overlaps window
      const overlaps =
        sStart.isSameOrBefore(monthEnd, "day") &&
        (!sEnd || sEnd.isSameOrAfter(monthStart, "day"));

      if (!overlaps) continue;

      if (s.billingType === "MONTHLY") {
        const activeDays = daysOverlapInMonth(
          sStart,
          sEnd,
          monthStart,
          monthEnd
        );
        if (activeDays <= 0) continue;

        const base = Number(s.amountMonthly || 0); // GST-exclusive per your schema
        if (base <= 0) continue;

        // pro-rate by active days within the month
        const prorated =
          Math.round(((base * activeDays) / daysInMonth) * 100) / 100;

        lineItems.push({
          description: `${s.kind} • MONTHLY • ${monthStart.format(
            "MMM YYYY"
          )} (${activeDays}/${daysInMonth} days)`,
          qty: undefined,
          amountExclGst: gstMode === "INCLUSIVE" ? undefined : prorated,
          amountInclGst: gstMode === "INCLUSIVE" ? prorated : undefined,
          originalAmount: base,
        });
      } else if (s.billingType === "ONE_TIME") {
        // bill once if start date is within the month
        if (sStart.isSame(monthStart, "month")) {
          const once = Number(s.amountOneTime || 0);
          if (once > 0) {
            lineItems.push({
              description: `${s.kind} • ONE_TIME • ${sStart.format(
                "DD MMM YYYY"
              )}`,
              qty: undefined,
              amountExclGst: gstMode === "INCLUSIVE" ? undefined : once,
              amountInclGst: gstMode === "INCLUSIVE" ? once : undefined,
              originalAmount: once,
            });
          }
        }
      }
    }

    if (lineItems.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "NO_ACTIVE_SERVICES_IN_MONTH" });
    }

    // Delegate to createInvoice with computed items
    req.body = {
      clientId,
      issueDate: issueDate || monthEnd.toDate(),
      periodStart: monthStart.toDate(),
      periodEnd: monthEnd.toDate(),
      billingType: "MONTHLY",
      lineItems,
      extraAmount,
      remarks:
        remarks ??
        `Auto-generated from services for ${monthStart.format("MMMM YYYY")}`,
      gstMode,
      totalDays: daysInMonth,
    };

    return createInvoice(req, res);
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
};
