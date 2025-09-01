// server/utils/pdf.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { round2 } from './money.js';

function currency(n) {
  return (Number(n) || 0).toFixed(2);
}

function rateLabel(gstMode) {
  if (gstMode === 'INCLUSIVE') return 'Rate (incl. GST)';
  // For EXCLUSIVE and NOGST we show excl. GST rates
  return 'Rate';
}

function priceForLine(li, gstMode) {
  if (gstMode === 'INCLUSIVE') return Number(li.unitPriceInclGst || 0);
  // EXCLUSIVE or NOGST
  return Number(li.unitPriceExclGst || 0);
}

export async function generateInvoicePDF({ invoice, client, payments }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(16).text('TAX INVOICE', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Invoice No: ${invoice.invoiceNo}`);
    doc.text(`Date: ${dayjs(invoice.issueDate).format('DD MMM YYYY')}`);
    if (invoice.periodStart && invoice.periodEnd) {
      doc.text(
        `Period: ${dayjs(invoice.periodStart).format('DD MMM')} - ${dayjs(invoice.periodEnd).format('DD MMM YYYY')}`
      );
    }
    if (invoice.gstMode) {
      const modeTxt =
        invoice.gstMode === 'INCLUSIVE'
          ? 'GST-INCLUSIVE'
          : invoice.gstMode === 'NOGST'
          ? 'NO GST'
          : 'GST-EXCLUSIVE';
      doc.text(`Pricing Mode: ${modeTxt}`);
    }
    doc.moveDown();

    // Bill To
    doc.fontSize(13).text(client.name || '', { continued: false });
    doc.fontSize(10);
    if (client.gstin) doc.text(`GSTIN: ${client.gstin}`);
    if (client.address) doc.text(client.address);
    if (client.phone) doc.text(`Phone: ${client.phone}`);
    if (client.email) doc.text(`Email: ${client.email}`);
    doc.moveDown();

    // Items table
    const colY = doc.y;
    doc.fontSize(12).text('Description', 36, colY, { continued: true });
    doc.text('Qty', 300, undefined, { width: 60, align: 'right', continued: true });
    doc.text(rateLabel(invoice.gstMode), 360, undefined, { width: 100, align: 'right', continued: true });
    doc.text('Amount', 460, undefined, { width: 100, align: 'right' });
    doc.moveTo(36, doc.y + 4).lineTo(560, doc.y + 4).stroke();

    // Render lines (display math only; totals will use invoice fields)
    let displayedSubtotal = 0;
    const itemStartY = doc.y + 8;

    doc.fontSize(11);
    (invoice.lineItems || []).forEach((li) => {
      const qty = Number(li.qty || 1);
      const rate = priceForLine(li, invoice.gstMode);
      const amt = round2(qty * rate);
      displayedSubtotal += amt;

      doc.text(li.description || '', 36, doc.y + 6, { continued: true });
      doc.text(String(qty), 300, undefined, { width: 60, align: 'right', continued: true });
      doc.text(currency(rate), 360, undefined, { width: 100, align: 'right', continued: true });
      doc.text(currency(amt), 460, undefined, { width: 100, align: 'right' });
    });

    // Extra Amount row (treated per your controller logic:
    // EXCLUSIVE/NOGST: extra is excl. GST; INCLUSIVE: extra is incl. GST)
    if (invoice.extraAmount) {
      const rate = Number(invoice.extraAmount || 0);
      const amt = rate; // qty 1
      displayedSubtotal += amt;
      doc.text('Extra Amount', 36, doc.y + 6, { continued: true });
      doc.text('1', 300, undefined, { width: 60, align: 'right', continued: true });
      doc.text(currency(rate), 360, undefined, { width: 100, align: 'right', continued: true });
      doc.text(currency(amt), 460, undefined, { width: 100, align: 'right' });
    }

    doc.moveDown();
    doc.moveTo(36, doc.y).lineTo(560, doc.y).stroke();

    // Totals (always trust invoice's stored numbers)
    doc.fontSize(12);

    // Subtotal (exclusive base)
    doc.text('Subtotal', 360, doc.y + 6, { width: 120, align: 'right', continued: true });
    doc.text(currency(invoice.subtotalExclGst), 480, undefined, { width: 80, align: 'right' });

    // GST line (skip for NOGST or 0% rate)
    const showGst = invoice.gstMode !== 'NOGST' && Number(invoice.gstRate || 0) > 0;
    if (showGst) {
      const modeNote = invoice.gstMode === 'INCLUSIVE' ? ' (included in prices)' : '';
      const ratePct = (Number(invoice.gstRate) * 100).toFixed(0);
      doc.text(`GST @ ${ratePct}%${modeNote}`, 360, doc.y + 4, { width: 120, align: 'right', continued: true });
      doc.text(currency(invoice.gstAmount), 480, undefined, { width: 80, align: 'right' });
    }

    // Total / Paid / Pending
    doc.text('Total', 360, doc.y + 4, { width: 120, align: 'right', continued: true });
    doc.text(currency(invoice.totalInclGst), 480, undefined, { width: 80, align: 'right' });

    doc.text('Paid', 360, doc.y + 4, { width: 120, align: 'right', continued: true });
    doc.text(currency(invoice.paidAmount), 480, undefined, { width: 80, align: 'right' });

    doc.text('Pending', 360, doc.y + 4, { width: 120, align: 'right', continued: true });
    doc.text(currency(invoice.pendingAmount), 480, undefined, { width: 80, align: 'right' });

    // Notes about mode
    if (invoice.gstMode === 'INCLUSIVE') {
      doc.moveDown();
      doc.fontSize(10).text('Note: Line item prices are GST-inclusive.');
    } else if (invoice.gstMode === 'NOGST') {
      doc.moveDown();
      doc.fontSize(10).text('Note: GST not applicable on this invoice.');
    }

    // Remarks
    if (invoice.remarks) {
      doc.moveDown();
      doc.fontSize(11).text(`Remarks: ${invoice.remarks}`);
    }

    // Payments short list
    if (payments?.length) {
      doc.moveDown();
      doc.fontSize(12).text('Payments:');
      payments.forEach((p) => {
        doc.fontSize(10).text(
          `• ${dayjs(p.date).format('DD MMM YYYY')} | ₹${currency(p.amount)} | ${p.mode}${
            p.slipRef ? ' | Ref: ' + p.slipRef : ''
          }`
        );
      });
    }

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

export async function generateLedgerPDF({ client, entries }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(16).text('CLIENT LEDGER', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(client.name || '');
    if (client.gstin) doc.text(`GSTIN: ${client.gstin}`);
    if (client.phone) doc.text(`Phone: ${client.phone}`);
    doc.moveDown();

    doc.text('Date', 36, doc.y, { continued: true });
    doc.text('Type', 150, undefined, { width: 80, align: 'left', continued: true });
    doc.text('Amount', 250, undefined, { width: 80, align: 'right', continued: true });
    doc.text('Balance', 350, undefined, { width: 80, align: 'right', continued: true });
    doc.text('Ref', 450, undefined, { width: 100, align: 'left' });
    doc.moveTo(36, doc.y + 4).lineTo(560, doc.y + 4).stroke();

    doc.fontSize(11);
    (entries || []).forEach((e) => {
      doc.text(dayjs(e.date).format('DD MMM YY'), 36, doc.y + 8, { continued: true });
      doc.text(e.type, 150, undefined, { width: 80, continued: true });
      doc.text(currency(e.amount), 250, undefined, { width: 80, align: 'right', continued: true });
      doc.text(currency(e.balanceAfter), 350, undefined, { width: 80, align: 'right', continued: true });
      doc.text(`${e.refType || ''}`, 450, undefined, { width: 100 });
    });

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}
