// server/controllers/quotationController.js
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import Client from "../models/Client.js";
import Quotation from "../models/Quotation.js";
import Invoice from "../models/Invoice.js";
import { nextQuoteNo } from "../utils/quoteNumber.js";
import { round2 } from "../utils/money.js";
import { generateQuotationPDF } from "../utils/pdf.js";
import { createInvoice } from "./invoiceController.js"; // for convert endpoint (reuse logic)

const ensureUploadsDir = () => {
  const dir = path.resolve("uploads");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};


export const createQuotation = async (req, res) => {
  try {
    const {
      clientId,                 // optional
      recipient = {},           // { name, email, phone, company, address }
      issueDate,
      validUntil,
      gstMode = "EXCLUSIVE",    // "EXCLUSIVE" | "INCLUSIVE" | "NOGST"
      gstRate: gstRateOverride,
      lineItems = [],           // [{ description, qty, unitPriceExclGst?, unitPriceInclGst?, frequency? }]
      extraAmount = 0,
      terms,
      notes,
      markSentTo = [],          // optional: array of emails to mark as sent
    } = req.body;

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ ok: false, error: "LINE_ITEMS_REQUIRED" });
    }


    const client = clientId ? await Client.findById(clientId) : null;

    const defaultGst = Number(process.env.GST_RATE || 0.18);
    const gstRate = gstMode === "NOGST" ? 0 : Number(gstRateOverride ?? defaultGst);

    // convert value to number safely
    const toNum = (v) => Number(v || 0);

    let sumExclusive = 0;
    let sumInclusive = 0;

    for (const it of lineItems) {
      const qty = toNum(it.qty || 1);
      const discount = toNum(it.discount || 0); // 👈 read discount

      if (gstMode === "INCLUSIVE") {
        const per = toNum(it.unitPriceInclGst);
        const net = per - discount;              // 👈 apply discount
        sumInclusive += round2(net * qty);
      } else {
        const per = toNum(it.unitPriceExclGst);
        const net = per - discount;              // 👈 apply discount
        sumExclusive += round2(net * qty);
      }
    }

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

    const quoteNo = await nextQuoteNo();

    // Map frontend frequency to BillingType in schema
    const lineItemsWithBilling = lineItems.map((it) => ({
      ...it,
      BillingType: it.frequency || "ONE_TIME",
       discount: toNum(it.discount || 0),
    }));

    const quotation = await Quotation.create({
      clientId: client?._id,
      quoteNo,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : undefined,
      recipient,
      lineItems: lineItemsWithBilling, // use frequency from frontend
      extraAmount: extra,
      gstMode,
      gstRate,
      subtotalExclGst,
      gstAmount,
      totalInclGst,
      terms,
      notes,
      status: markSentTo?.length ? "SENT" : "DRAFT",
      sentTo: markSentTo || [],
      sentAt: markSentTo?.length ? new Date() : undefined,
    });

    // PDF
    ensureUploadsDir();
    const outPath = path.resolve("uploads", `${quotation.quoteNo}.pdf`);
    await generateQuotationPDF({ quotation, client }, outPath);
    quotation.pdfPath = outPath;
    await quotation.save();

    const pdfUrl = `${process.env.BASE_URL}/uploads/${path.basename(outPath)}`;
    res.json({ ok: true, quotation, pdfUrl });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};


// ---------- LIST / GET ----------
export const listQuotations = async (req, res) => {
  try {
    const { q = "", page = "1", limit = "25", status } = req.query;

    const where = {};
    if (q.trim()) {
      where.$or = [
        { quoteNo: { $regex: q, $options: "i" } },
        { "recipient.name": { $regex: q, $options: "i" } },
        { "recipient.email": { $regex: q, $options: "i" } },
      ];
    }
    if (status) where.status = status;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
    const skip = (pageNum - 1) * lim;

    const [rows, total] = await Promise.all([
      Quotation.find(where).sort({ createdAt: -1 }).skip(skip).limit(lim),
      Quotation.countDocuments(where),
    ]);

    res.json({ ok: true, list: rows, pagination: { page: pageNum, limit: lim, total, pages: Math.ceil(total / lim) } });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const getQuotationPdf = async (req, res) => {
  try {
    // Accept both Mongo _id or quote number (e.g. QTN-0007)
    const { quotationIdOrNo } = req.params;

    let qtn = null;

    // Try as ObjectId first
    try {
      qtn = await Quotation.findById(quotationIdOrNo);
    } catch {
      // ignore cast errors
    }

    // If not found by _id, try by quote number
    if (!qtn) {
      qtn = await Quotation.findOne({ quoteNo: quotationIdOrNo });
    }

    if (!qtn) {
      return res.status(404).json({ ok: false, error: "QUOTATION_NOT_FOUND" });
    }

    // Ensure PDF exists; regenerate if missing
    let pdfPath = qtn.pdfPath;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const client = qtn.clientId ? await Client.findById(qtn.clientId) : null;

      // Ensure uploads dir
      const uploadsDir = path.resolve("uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

      pdfPath = path.resolve(uploadsDir, `${qtn.quoteNo}.pdf`);
      await generateQuotationPDF({ quotation: qtn, client }, pdfPath);

      qtn.pdfPath = pdfPath;
      await qtn.save();
    }

    const url = `${process.env.BASE_URL}/uploads/${path.basename(pdfPath)}`;
    return res.json({ ok: true, url });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
};

// ---------- STATUS UPDATE / MARK SENT ----------
export const updateQuotationStatus = async (req, res) => {
  try {
    const { quotationId } = req.params;
    const { status, addSentTo = [] } = req.body;

    const qtn = await Quotation.findById(quotationId);
    if (!qtn) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    if (status) qtn.status = status;
    if (Array.isArray(addSentTo) && addSentTo.length) {
      qtn.sentTo.push(...addSentTo);
      qtn.sentAt = new Date();
      if (qtn.status === "DRAFT") qtn.status = "SENT";
    }
    await qtn.save();
    res.json({ ok: true, quotation: qtn });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

// ---------- CONVERT TO INVOICE ----------
export const convertQuotationToInvoice = async (req, res, next) => {
  try {
    const { quotationId } = req.params;
    const qtn = await Quotation.findById(quotationId);
    if (!qtn) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!qtn.clientId) return res.status(400).json({ ok: false, error: "CLIENT_REQUIRED_TO_CONVERT" });

    // map quotation items to invoice-style line totals
    const items = qtn.lineItems.map((it) => {
      const qty = Number(it.qty || 1);
      return qtn.gstMode === "INCLUSIVE"
        ? {
          description: it.description,
          qty,
          amountInclGst: round2(Number(it.unitPriceInclGst || 0) * qty),
          originalAmount: it.originalAmount,
        }
        : {
          description: it.description,
          qty,
          amountExclGst: round2(Number(it.unitPriceExclGst || 0) * qty),
          originalAmount: it.originalAmount,
        };
    });

    // call your existing invoice creation logic
    req.body = {
      clientId: qtn.clientId,
      issueDate: new Date(),
      lineItems: items,
      extraAmount: qtn.extraAmount,
      remarks: `Converted from quotation ${qtn.quoteNo}`,
      gstMode: qtn.gstMode,
      gstRate: qtn.gstRate,
      billingType: qtn.lineItems?.BillingType || "ONE_TIME",
    };


    // mark accepted
    qtn.status = "ACCEPTED";
    await qtn.save();

    return createInvoice(req, res);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
