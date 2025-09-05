import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Client from '../models/Client.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { round2 } from '../utils/money.js';
import { getCurrentBalance } from '../utils/balance.js';
import { generatePaymentPDF } from '../utils/pdf.js';
import path from 'path';
import { nextPaymentNo } from "../utils/paymentNumber.js";

export const recordPayment = async (req, res) => {
  try {
    const { clientId, invoiceId, date, amount, mode, slipRef, notes } = req.body;
    const attachmentPath = req.file ? req.file.path : undefined;

    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ ok: false, error: "CLIENT_NOT_FOUND" });

    const amt = round2(Number(amount || 0));
    if (amt <= 0) return res.status(400).json({ ok: false, error: "AMOUNT_REQUIRED" });

    // Generate next sequential payment number
    const receiptNo = await nextPaymentNo();

    // Create Payment doc (invoiceId is optional)
    const inv = invoiceId ? await Invoice.findById(invoiceId) : null;
    const pay = await Payment.create({
      clientId,
      invoiceId: inv?._id, // optional
      receiptNo,           // 👈 add this
      date: new Date(date || new Date()),
      amount: amt,
      mode: mode || "OTHER",
      slipRef,
      notes,
      attachmentPath,
    });

    // ----- Ledger CREDIT for the full receipt (even if it's an advance) -----
    const prevBal = await getCurrentBalance(clientId);
    const newBal = round2(prevBal - amt);

    await LedgerEntry.create({
      clientId,
      date: new Date(date || new Date()),
      type: "CREDIT",
      amount: amt,
      balanceAfter: newBal,
      refType: "PAYMENT",
      refId: pay._id,
      remarks: inv
        ? `Payment against ${inv.invoiceNo}${slipRef ? " | Ref: " + slipRef : ""}`
        : `Advance payment${slipRef ? " | Ref: " + slipRef : ""}`,
    });

    // ----- If an invoice was provided, apply up to pending -----
    let applied = 0,
      pendingAfter = null;
    if (inv) {
      const canApply = Math.min(inv.pendingAmount, amt);
      if (canApply > 0) {
        inv.paidAmount = round2(inv.paidAmount + canApply);
        inv.pendingAmount = round2(inv.totalInclGst - inv.paidAmount);
        inv.status =
          inv.pendingAmount <= 0
            ? "PAID"
            : inv.paidAmount > 0
            ? "PARTIALLY_PAID"
            : "DUE";
        await inv.save();
        applied = canApply;
        pendingAfter = inv.pendingAmount;
      }
    }

    // generate PDF (pass receiptNo also)
    const pdfPath = await generatePaymentPDF(client, pay, inv);

    res.json({
      ok: true,
      payment: pay,
      isAdvance: !inv,
      invoiceAppliedTo: inv
        ? { id: inv._id, invoiceNo: inv.invoiceNo, applied, pendingAfter }
        : null,
      attachmentUrl: attachmentPath
        ? `${process.env.BASE_URL}/` + attachmentPath.replace(/\\/g, "/")
        : null,
      pdfUrl: `${process.env.BASE_URL}/${pdfPath.replace(/\\/g, "/")}`,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};


export const getPayments = async (req, res) => {
  try {
    // Fetch all payments, you can add filters later if needed
    const payments = await Payment.find().sort({ date: -1 });

    const results = await Promise.all(
      payments.map(async (p) => {
        const client = await Client.findById(p.clientId);
        const inv = p.invoiceId ? await Invoice.findById(p.invoiceId) : null;

        // Build PDF URL
        let pdfUrl = "";
        try {
          const receiptNo = p.receiptNo;
          pdfUrl = `${process.env.BASE_URL}/uploads/payments/${receiptNo}.pdf`;
        } catch (err) {
          pdfUrl = null;
        }

        return {
          _id: p._id,
          receiptNo: p.receiptNo,
          clientName: client?.name || "Unknown",
          invoiceNo: inv?.invoiceNo || null,
          amount: p.amount,
          mode: p.mode,
          date: p.date,
          pdfUrl,
        };
      })
    );

    res.json(results);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

