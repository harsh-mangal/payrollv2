// server/utils/pdf.js
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import { round2 } from "./money.js";

/* ----------------------------- Helpers ----------------------------- */

function currency(n) {
  const num = Number.isFinite(Number(n)) ? Number(n) : 0;
  return num.toFixed(2);
}

function pct(n) {
  const val = Number(n || 0) * 100;
  // Show up to 2 decimals; strip trailing zeros
  return (Math.round(val * 100) / 100).toString().replace(/\.0+$/, "");
}

function labelForAmount(gstMode) {
  if (gstMode === "INCLUSIVE") return "Amount (Incl. GST)";
  if (gstMode === "NOGST") return "Amount";
  return "Amount (Excl. GST)";
}

// Prefer new service-based amounts; fall back to legacy (qty*rate) if present
function computeLineAmount(li, gstMode) {
  if (gstMode === "INCLUSIVE") {
    if (li.amountInclGst != null) return Number(li.amountInclGst) || 0;
    // legacy fallback:
    const qty = Number(li.qty || 1);
    const rate = Number(li.unitPriceInclGst || 0);
    return round2(qty * rate);
  }
  // EXCLUSIVE or NOGST
  if (li.amountExclGst != null) return Number(li.amountExclGst) || 0;
  // legacy fallback:
  const qty = Number(li.qty || 1);
  const rate = Number(li.unitPriceExclGst || 0);
  return round2(qty * rate);
}

/* Simple table row helper */
function drawRow(doc, x, y, widths, cells, opts = {}) {
  const {
    fontSize = 10,
    bold = false,
    fill = null,
    color = "#000000",
    align = [],
  } = opts;
  const startY = y;
  let cursorX = x;

  if (fill) {
    const totalW = widths.reduce((a, b) => a + b, 0);
    doc
      .save()
      .rect(cursorX, y - 2, totalW, fontSize + 8)
      .fill(fill)
      .restore();
  }

  doc
    .fillColor(color)
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(fontSize);

  for (let i = 0; i < cells.length; i++) {
    const cellW = widths[i];
    const a = align[i] || "left";
    doc.text(cells[i] ?? "", cursorX + 6, y, { width: cellW - 12, align: a });
    cursorX += cellW;
  }
  return startY + fontSize + 10; // next y
}

function hr(doc, x1, x2, y) {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor("#DDDDDD").lineWidth(1).stroke();
}

/* ----------------------------- Invoice PDF ----------------------------- */

export async function generateInvoicePDF(
  { invoice, client, payments },
  outPath
) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const pageW = doc.page.width;
    const left = 36;
    const right = pageW - 36;

    /* Header */
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("TAX INVOICE", left, 36, { align: "right" });
    doc.moveDown(0.5);

    const hdrX = left;
    let y = 36;

    // Company (optional): If you want, add your company block here

    // Invoice meta (right aligned block)
    doc.font("Helvetica").fontSize(10);
    const meta = [
      ["Invoice No", invoice.invoiceNo],
      ["Date", dayjs(invoice.issueDate).format("DD MMM YYYY")],
      invoice.periodStart && invoice.periodEnd
        ? [
            "Billing Period",
            `${dayjs(invoice.periodStart).format("DD MMM YYYY")} – ${dayjs(
              invoice.periodEnd
            ).format("DD MMM YYYY")}`,
          ]
        : null,
      [
        "Billing Type",
        invoice.billingType === "MONTHLY" ? "Monthly" : "One Time",
      ],
      [
        "GST Mode",
        invoice.gstMode === "INCLUSIVE"
          ? "GST-Inclusive"
          : invoice.gstMode === "NOGST"
          ? "No GST"
          : "GST-Exclusive",
      ],
      invoice.gstMode !== "NOGST"
        ? ["GST Rate", `${pct(invoice.gstRate)}%`]
        : null,
    ].filter(Boolean);

    // Left: Bill To
    y += 8;
    doc.font("Helvetica-Bold").fontSize(12).text("Bill To", hdrX, y);
    y += 16;
    doc.font("Helvetica").fontSize(11);
    doc.text(client?.name || "", hdrX, y);
    y += 14;
    doc.fontSize(10);
    if (client?.gstin) {
      doc.text(`GSTIN: ${client.gstin}`, hdrX, y);
      y += 12;
    }
    if (client?.address) {
      doc.text(client.address, hdrX, y, { width: 300 });
      y = doc.y + 6;
    }
    if (client?.phone) {
      doc.text(`Phone: ${client.phone}`, hdrX, y);
      y += 12;
    }
    if (client?.email) {
      doc.text(`Email: ${client.email}`, hdrX, y);
      y += 12;
    }

    // Right: meta
    let metaY = 60;
    const metaX = right - 220;
    doc.font("Helvetica").fontSize(10);
    meta.forEach(([k, v]) => {
      doc.font("Helvetica-Bold").text(`${k}:`, metaX, metaY, { width: 90 });
      doc
        .font("Helvetica")
        .text(String(v ?? ""), metaX + 95, metaY, {
          width: 120,
          align: "right",
        });
      metaY += 14;
    });

    // Move below the taller of left/right blocks
    y = Math.max(y + 8, metaY + 8);
    hr(doc, left, right, y);
    y += 12;

    /* Items Table */
    const colX = left;
    const tableWidths = [right - left - 140, 140]; // Description | Amount
    const headerFill = "#F5F6FA";

    // Header row
    y = drawRow(
      doc,
      colX,
      y,
      tableWidths,
      ["Description", labelForAmount(invoice.gstMode)],
      { bold: true, fontSize: 11, fill: headerFill, align: ["left", "right"] }
    );
    hr(doc, left, right, y - 4);

    // Rows
    doc.font("Helvetica").fontSize(10).fillColor("#000000");

    (invoice.lineItems || []).forEach((li) => {
      const desc = li.description || "";
      const amt = computeLineAmount(li, invoice.gstMode);
      y = drawRow(doc, colX, y, tableWidths, [desc, `₹ ${currency(amt)}`], {
        align: ["left", "right"],
      });
      // Page break (simple)
      if (y > doc.page.height - 180) {
        doc.addPage();
        y = 36;
      }
    });

    // Extra amount row (as separate line item)
    if (Number(invoice.extraAmount || 0) !== 0) {
      y = drawRow(
        doc,
        colX,
        y,
        tableWidths,
        ["Extra Amount", `₹ ${currency(invoice.extraAmount)}`],
        { bold: false, align: ["left", "right"] }
      );
    }

    hr(doc, left, right, y + 4);
    y += 12;

    /* Totals Box (right side) */
    const boxW = 260;
    const boxX = right - boxW;
    const lineH = 16;

    const showGst =
      invoice.gstMode !== "NOGST" && Number(invoice.gstRate || 0) > 0;

    // Frame
    doc
      .roundedRect(boxX, y, boxW, showGst ? 4 * lineH + 24 : 3 * lineH + 24, 6)
      .strokeColor("#DDDDDD")
      .stroke();

    let ty = y + 10;
    const keyW = 140,
      valW = boxW - keyW;

    const row = (k, v, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(11)
        .fillColor("#000000");
      doc.text(k, boxX + 10, ty, { width: keyW });
      doc.text(v, boxX + 10 + keyW, ty, { width: valW, align: "right" });
      ty += lineH;
    };

    row("Taxable Value (Subtotal)", `₹ ${currency(invoice.subtotalExclGst)}`);
    if (showGst) {
      const modeNote = invoice.gstMode === "INCLUSIVE" ? " (incl.)" : "";
      row(
        `GST @ ${pct(invoice.gstRate)}%${modeNote}`,
        `₹ ${currency(invoice.gstAmount)}`
      );
    }
    row("Total (Gross)", `₹ ${currency(invoice.totalInclGst)}`, true);
    row("Paid", `₹ ${currency(invoice.paidAmount)}`);
    row("Pending", `₹ ${currency(invoice.pendingAmount)}`, true);

    y = ty + 8;

    // Notes
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    if (invoice.gstMode === "INCLUSIVE") {
      doc.text("Note: Line item prices are GST-inclusive.", left, y);
      y += 12;
    } else if (invoice.gstMode === "NOGST") {
      doc.text("Note: GST not applicable on this invoice.", left, y);
      y += 12;
    }

    // Remarks
    if (invoice.remarks) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#000000")
        .text("Remarks", left, y);
      y += 12;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#000000")
        .text(invoice.remarks, left, y, { width: right - left });
      y = doc.y + 8;
    }

    // Payments (optional list)
    if (payments?.length) {
      y += 8;
      doc.font("Helvetica-Bold").fontSize(11).text("Payments", left, y);
      y += 12;
      payments.forEach((p) => {
        const line = `${dayjs(p.date).format("DD MMM YYYY")}  •  ₹${currency(
          p.amount
        )}  •  ${p.mode || "—"}${p.slipRef ? `  •  Ref: ${p.slipRef}` : ""}`;
        doc.font("Helvetica").fontSize(10).text(line, left, y);
        y += 14;
      });
    }

    // Footer (simple)
    doc.font("Helvetica").fontSize(9).fillColor("#888888");
    doc.text(
      "This is a computer-generated document. No signature required.",
      left,
      doc.page.height - 50,
      { align: "center", width: right - left }
    );

    doc.end();
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
  });
}

/* ----------------------------- Ledger PDF ----------------------------- */

export async function generateLedgerPDF({ client, entries }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const left = 36;
    const right = doc.page.width - 36;
    let y = 36;

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("CLIENT LEDGER", left, y, { align: "center" });
    y += 28;

    // Client block
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(client?.name || "", left, y);
    y += 16;
    doc.font("Helvetica").fontSize(10);
    if (client?.gstin) {
      doc.text(`GSTIN: ${client.gstin}`, left, y);
      y += 12;
    }
    if (client?.phone) {
      doc.text(`Phone: ${client.phone}`, left, y);
      y += 12;
    }
    if (client?.email) {
      doc.text(`Email: ${client.email}`, left, y);
      y += 12;
    }
    if (client?.address) {
      doc.text(client.address, left, y, { width: right - left });
      y = doc.y + 8;
    }

    hr(doc, left, right, y);
    y += 12;

    // Table header
    const widths = [90, 80, 100, 100, 120]; // Date | Type | Amount | Balance | Reference
    y = drawRow(
      doc,
      left,
      y,
      widths,
      ["Date", "Type", "Amount (₹)", "Balance (₹)", "Reference"],
      {
        bold: true,
        fontSize: 11,
        fill: "#F5F6FA",
        align: ["left", "left", "right", "right", "left"],
      }
    );
    hr(doc, left, right, y - 4);

    // Rows
    doc.font("Helvetica").fontSize(10).fillColor("#000000");
    (entries || []).forEach((e) => {
      y = drawRow(
        doc,
        left,
        y,
        widths,
        [
          dayjs(e.date).format("DD MMM YYYY"),
          String(e.type || ""),
          currency(e.amount),
          currency(e.balanceAfter),
          `${e.refType || ""}${e.refId ? ` #${e.refId}` : ""}`,
        ],
        { align: ["left", "left", "right", "right", "left"] }
      );
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 36;
      }
    });

    // Footer
    doc.font("Helvetica").fontSize(9).fillColor("#888888");
    doc.text("Generated by the system.", left, doc.page.height - 50, {
      align: "center",
      width: right - left,
    });

    doc.end();
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
  });
}
