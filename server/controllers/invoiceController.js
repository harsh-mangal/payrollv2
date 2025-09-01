// server/controllers/invoiceController.js
import Client from '../models/Client.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { nextInvoiceNo } from '../utils/invoiceNumber.js';
import { round2 } from '../utils/money.js';
import { generateInvoicePDF } from '../utils/pdf.js';
import { getCurrentBalance } from '../utils/balance.js';
import path from 'path';

// ---------- CREATE INVOICE (with auto-advance adjustment) ----------
// ...imports/top unchanged...

export const createInvoice = async (req, res) => {
  try {
    const {
      clientId, issueDate, periodStart, periodEnd,
      lineItems = [], extraAmount = 0, remarks,
      gstMode = 'EXCLUSIVE',           // <-- NEW
      gstRate: gstRateOverride         // <-- optional override
    } = req.body;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });

    const invoiceNo = await nextInvoiceNo();
    const defaultGst = Number(process.env.GST_RATE || 0.18);
    const gstRate = gstMode === 'NOGST' ? 0 : Number(gstRateOverride ?? defaultGst);

    // ---- PRICE ACCUMULATION BASED ON MODE ----
    const toNum = (v) => Number(v || 0);
    const sumExclusive = lineItems.reduce((s, it) => {
      const price = gstMode === 'INCLUSIVE'
        ? null
        : toNum(it.unitPriceExclGst);
      return s + (toNum(it.qty || 1) * (price ?? 0));
    }, 0);

    const sumInclusive = lineItems.reduce((s, it) => {
      const price = gstMode === 'INCLUSIVE'
        ? toNum(it.unitPriceInclGst)
        : null;
      return s + (toNum(it.qty || 1) * (price ?? 0));
    }, 0);

    const extra = toNum(extraAmount);

    let subtotalExclGst, gstAmount, totalInclGst;

    if (gstMode === 'EXCLUSIVE') {
      subtotalExclGst = round2(sumExclusive + extra);
      gstAmount       = round2(subtotalExclGst * gstRate);
      totalInclGst    = round2(subtotalExclGst + gstAmount);
    } else if (gstMode === 'INCLUSIVE') {
      // sumInclusive (and extra) are GST-inclusive amounts
      const gross = round2(sumInclusive + extra);
      const divisor = 1 + gstRate;
      const base = gstRate > 0 ? round2(gross / divisor) : gross;
      subtotalExclGst = base;
      gstAmount       = round2(gross - base);
      totalInclGst    = gross;
    } else { // NOGST
      subtotalExclGst = round2(sumExclusive + extra); // treat as no tax
      gstAmount       = 0;
      totalInclGst    = subtotalExclGst;
    }

    // ---- Create invoice ----
    const invoice = await Invoice.create({
      clientId, invoiceNo,
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      lineItems, extraAmount: extra, remarks,
      gstMode,
      subtotalExclGst, gstRate, gstAmount, totalInclGst,
      paidAmount: 0,
      pendingAmount: totalInclGst,
      status: 'DUE'
    });

    // ---- Ledger & auto-advance (unchanged from your current file) ----
    const prevBal = await getCurrentBalance(clientId);
    const afterInvoiceBal = round2(prevBal + totalInclGst);
    await LedgerEntry.create({
      clientId,
      date: new Date(),
      type: 'DEBIT',
      amount: totalInclGst,
      balanceAfter: afterInvoiceBal,
      refType: 'INVOICE',
      refId: invoice._id,
      remarks: `Invoice ${invoice.invoiceNo}`
    });

    const availableAdvance = prevBal < 0 ? round2(-prevBal) : 0;
    if (availableAdvance > 0) {
      const apply = Math.min(availableAdvance, totalInclGst);
      if (apply > 0) {
        invoice.paidAmount = round2(invoice.paidAmount + apply);
        invoice.pendingAmount = round2(invoice.totalInclGst - invoice.paidAmount);
        invoice.status = invoice.pendingAmount <= 0 ? 'PAID'
          : (invoice.paidAmount > 0 ? 'PARTIALLY_PAID' : 'DUE');
        await invoice.save();

        const afterAdjustBal = round2(afterInvoiceBal - apply);
        await LedgerEntry.create({
          clientId,
          date: new Date(),
          type: 'CREDIT',
          amount: apply,
          balanceAfter: afterAdjustBal,
          refType: 'ADJUSTMENT',
          refId: invoice._id,
          remarks: `Advance adjusted against ${invoice.invoiceNo}`
        });
      }
    }

    // ---- PDF ----
    const outPath = path.resolve('uploads', `${invoice.invoiceNo}.pdf`);
    await generateInvoicePDF({ invoice, client, payments: [] }, outPath);
    invoice.pdfPath = outPath;
    await invoice.save();

    res.json({ ok: true, invoice, pdfUrl: `${process.env.BASE_URL}/uploads/${path.basename(outPath)}` });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};


// ---------- GET INVOICE PDF URL (ADD THIS BACK) ----------
export const getInvoicePdf = async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    if (!inv.pdfPath) return res.status(404).json({ ok: false, error: 'PDF_NOT_READY' });
    res.json({
      ok: true,
      url: `${process.env.BASE_URL}/uploads/${path.basename(inv.pdfPath)}`
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
