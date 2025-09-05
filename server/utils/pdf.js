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
function computeLineAmount(lineItem, gstMode) {
  if (gstMode === 'INCLUSIVE') {
    return Number(lineItem.unitPriceInclGst || 0);
  } else if (gstMode === 'EXCLUSIVE') {
    return Number(lineItem.unitPriceExclGst || 0);
  } else {
    // NOGST
    return Number(lineItem.unitPriceExclGst || lineItem.unitPriceInclGst || 0);
  }
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
  { invoice, client, totalDays, payments },
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
      .fillColor("#222222")
      .text("CASH MEMO", left, 36, { align: "right" });

    let y = 36;

    // Left: Bill To
    y += 40;
    doc.font("Helvetica-Bold").fontSize(10).text("Bill To", left, y);
    y += 18;
    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    doc.text(client?.name || "", left, y);
    y += 14;
    doc.fontSize(8);
    if (client?.gstin) {
      doc.text(`GSTIN: ${client.gstin}`, left, y);
      y += 12;
    }
    if (client?.address) {
      doc.text(client.address, left, y, { width: 280 });
      y = doc.y + 6;
    }
    if (client?.phone) {
      doc.text(`Phone: ${client.phone}`, left, y);
      y += 12;
    }
    if (client?.email) {
      doc.text(`Email: ${client.email}`, left, y);
      y += 12;
    }

    // Right: Invoice Meta
    const metaX = right - 240;
    let metaY = 80;
    doc.font("Helvetica").fontSize(8).fillColor("#000000");

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
      ["Billing Type", invoice.billingType === "MONTHLY" ? "Monthly" : "One Time"],
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

    meta.forEach(([k, v]) => {
      doc.font("Helvetica-Bold").text(`${k}:`, metaX, metaY, { width: 100 });
      doc
        .font("Helvetica")
        .text(String(v ?? ""), metaX + 105, metaY, { width: 130, align: "right" });
      metaY += 14;
    });

    // Separator
    y = Math.max(y + 10, metaY + 10);
    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .dash(3, { space: 2 })
      .strokeColor("#CCCCCC")
      .stroke()
      .undash();
    y += 16;

    /* Items Table */
    // Dynamically set table columns based on totalDays
    const hasTotalDays = totalDays && totalDays > 0;
    const tableWidths = hasTotalDays
      ? [right - left - 280, 90, 90, 100] // Description | Monthly Price | Period Days | Amount
      : [right - left - 100, 100]; // Description | Amount
    const headers = hasTotalDays
      ? ["Description", "Monthly Price", "Period Days", "Amount (Excl. GST)"]
      : ["Description", "Amount (Excl. GST)"];
    const aligns = hasTotalDays
      ? ["left", "right", "right", "right"]
      : ["left", "right"];

    const headerFill = "#F5F6FA";

    // Header row
    y = drawRow(doc, left, y, tableWidths, headers, {
      bold: true,
      fontSize: 9,
      fill: headerFill,
      align: aligns,
    });
    y += 2;

    // Rows
    let rowIndex = 0;
    (invoice.lineItems || []).forEach((li) => {
      const desc = li.description || "";
      const amt = computeLineAmount(li, invoice.gstMode);
      const rowData = hasTotalDays
        ? [
          desc,
          li.originalAmount ? `₹ ${currency(li.originalAmount)}` : "",
          totalDays || "",
          `₹ ${currency(amt)}`,
        ]
        : [desc, `₹ ${currency(amt)}`];
      const fill = rowIndex % 2 === 0 ? "#FFFFFF" : "#FAFAFA";
      y = drawRow(doc, left, y, tableWidths, rowData, {
        align: aligns,
        fill,
        fontSize: 8,
      });
      rowIndex++;
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 36;
      }
    });

    // Extra amount row
    if (Number(invoice.extraAmount || 0) !== 0) {
      const rowData = hasTotalDays
        ? ["Extra Amount", "", "", `₹ ${currency(invoice.extraAmount)}`]
        : ["Extra Amount", `₹ ${currency(invoice.extraAmount)}`];
      y = drawRow(doc, left, y, tableWidths, rowData, {
        align: aligns,
        fill: "#FAFAFA",
        fontSize: 8,
      });
    }

    y += 16;

    /* Totals Box */
    const boxW = 280;
    const boxX = right - boxW;
    const lineH = 16;

    const showGst = invoice.gstMode !== "NOGST" && Number(invoice.gstRate || 0) > 0;

    // Calculate row count
    let rowCount = 3; // Subtotal, Total, Pending
    if (showGst) rowCount++;
    rowCount++; // Paid always

    // Box height = rows * lineH + padding (top+bottom = 20px)
    const boxH = rowCount * lineH + 20;

    // Background box
    doc
      .roundedRect(boxX, y, boxW, boxH, 8)
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .stroke();

    let ty = y + 10;
    const keyW = 130;
    const valW = boxW - keyW - 30;

    const row = (k, v, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor("#000000");
      doc.text(k, boxX + 10, ty, { width: keyW });
      doc.text(v, boxX + keyW + 20, ty, { width: valW, align: "right" });
      ty += lineH;
    };

    row("Taxable Value (Subtotal)", `₹ ${currency(invoice.subtotalExclGst)}`);
    if (showGst) {
      const note = invoice.gstMode === "INCLUSIVE" ? " (incl.)" : "";
      row(`GST @ ${pct(invoice.gstRate)}%${note}`, `₹ ${currency(invoice.gstAmount)}`);
    }
    row("Total (Gross)", `₹ ${currency(invoice.totalInclGST)}`, true);
    row("Paid", `₹ ${currency(invoice.paidAmount)}`);
    row("Pending", `₹ ${currency(invoice.pendingAmount)}`, true);

    y = ty + 12;

    /* Notes */
    doc.font("Helvetica").fontSize(8).fillColor("#555555");
    if (invoice.gstMode === "INCLUSIVE") {
      doc.text("Note: Line item prices are GST-inclusive.", left, y);
      y += 12;
    } else if (invoice.gstMode === "NOGST") {
      doc.text("Note: GST not applicable on this invoice.", left, y);
      y += 12;
    }

    /* Remarks */
    if (invoice.remarks) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000").text("Remarks", left, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).fillColor("#000000").text(invoice.remarks, left, y, {
        width: right - left,
      });
      y = doc.y + 12;
    }

    /* Payments */
    if (payments?.length) {
      y += 8;
      doc.font("Helvetica-Bold").fontSize(9).text("Payments", left, y);
      y += 14;
      payments.forEach((p) => {
        const line = `${dayjs(p.date).format("DD MMM YYYY")}  •  ₹${currency(
          p.amount
        )}  •  ${p.mode || "—"}${p.slipRef ? `  •  Ref: ${p.slipRef}` : ""}`;
        doc.font("Helvetica").fontSize(8).text(line, left, y);
        y += 14;
      });
    }

    /* Footer */
    doc.font("Helvetica").fontSize(8).fillColor("#777777");
    doc.text(
      "This is a computer-generated invoice. No signature required.",
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


// server/utils/pdf.js (add this next to other exports)
export async function generateQuotationPDF({ quotation, client }, outPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      /* ---------------- Header ---------------- */
      doc
        .fontSize(16)
        .fillColor("#1a1a1a")
        .text("QUOTATION", { align: "center" })
        .moveDown(1.2);

      // Client details
      doc
        .fontSize(9)
        .fillColor("#333")
        .text(`To: ${client.name}`, { continued: false })
        .text(client.company || "")
        .text(client.address || "")
        .text(client.phone ? `Phone: ${client.phone}` : "")
        .text(client.email ? `Email: ${client.email}` : "")
        .moveDown(1.2);

      /* ---------------- Quotation Info ---------------- */
      doc
        .fontSize(9)
        .fillColor("#000")
        .text(`Quotation No: ${quotation.quoteNo}`)
        .text(`Issue Date: ${dayjs(quotation.issueDate).format("DD/MM/YYYY")}`)
        .text(`Valid Until: ${dayjs(quotation.validUntil).format("DD/MM/YYYY")}`)
        .moveDown(1.2);

      /* ---------------- Line Items Table ---------------- */
      const tableTop = doc.y;
      const itemX = 50;
      const billingX = 220;
      const unitX = 320;
      const discountX = 400;
      const finalX = 480;

      // Header row
      doc
        .fontSize(9)
        .fillColor("#000")
        .font("Helvetica-Bold")
        .text("Description", itemX, tableTop)
        .text("Billing", billingX, tableTop)
        .text("Item Price", unitX, tableTop)
        .text("Discount", discountX, tableTop)
        .text("Final Price", finalX, tableTop);

      doc
        .moveTo(50, tableTop + 16)
        .lineTo(550, tableTop + 16)
        .lineWidth(0.7)
        .strokeColor("#999")
        .stroke();

      let y = tableTop + 24;

      doc.font("Helvetica").fillColor("#333");
      quotation.lineItems.forEach((it) => {
        const qty = it.qty || 1;
        const discount = it.discount || 0;
        const per =
          quotation.gstMode === "INCLUSIVE"
            ? it.unitPriceInclGst
            : it.unitPriceExclGst;

        const itemTotal = (per || 0) * qty;
        const discountTotal = discount ? discount * qty : 0;
        const finalTotal = discount ? itemTotal - discountTotal : null;

        doc.fontSize(9);
        doc.text(it.description, itemX, y, { width: 160 });
        doc.text(it.BillingType || "-", billingX, y);
        doc.text(currency(itemTotal), unitX, y);
        doc.text(discount ? currency(discountTotal) : "---", discountX, y);
        doc.text(finalTotal !== null ? currency(finalTotal) : "---", finalX, y);

        y += 18;

        // dotted separator between rows
        doc
          .moveTo(50, y - 5)
          .lineTo(550, y - 5)
          .lineWidth(0.4)
          .dash(2, { space: 2 })
          .strokeColor("#ccc")
          .stroke()
          .undash();
      });

      /* ---------------- Totals ---------------- */
      y += 15;
      doc.moveTo(320, y).lineTo(550, y).strokeColor("#999").stroke();
      y += 8;

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Subtotal:", 360, y);
      doc.text(currency(quotation.subtotalExclGst), finalX, y);

      y += 15;
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("GST:", 360, y);
      doc.text(currency(quotation.gstAmount), finalX, y);

      y += 15;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#000");
      doc.text("Total:", 360, y);
      doc.text(currency(quotation.totalInclGst), finalX, y);

      /* ---------------- Notes & Terms ---------------- */
      y += 30;
      if (quotation.notes) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#333").text("Notes:", 50, y);
        y += 12;
        doc.font("Helvetica").fontSize(9).fillColor("#444").text(quotation.notes, 50, y, { width: 500 });
      }

      if (quotation.terms) {
        y += 30;
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#333").text("Terms & Conditions:", 50, y);
        y += 12;
        doc.font("Helvetica").fontSize(9).fillColor("#444").text(quotation.terms, 50, y, { width: 500 });
      }

      /* ---------------- Footer ---------------- */
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#666")
        .text("This is a system generated quotation.", 50, 770, {
          align: "center",
          width: 500,
        });

      doc.end();
      stream.on("finish", () => resolve(outPath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
}


//Genrate Payment Pdf

export const generatePaymentPDF = async (client, payment, invoice) => {
  return new Promise((resolve, reject) => {
    const dir = path.join("uploads", "payments");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${payment.receiptNo}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // ----- Header -----
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#333333")
      .text("Payment Receipt", { align: "center" });

    doc.moveDown(1.5);

    // ----- Client Info -----
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#555555")
      .text("Client Details:", { underline: true });

    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(11).fillColor("#000000");
    doc.text(`Name    : ${client.name}`);
    if (client.email) doc.text(`Email   : ${client.email}`);
    if (client.phone) doc.text(`Phone   : ${client.phone}`);
    if (client.address) doc.text(`Address : ${client.address}`);

    doc.moveDown(1);

    // ----- Payment Info as Horizontal Table -----
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#555555")
      .text("Payment Details:", { underline: true });

    doc.moveDown(0.5);

    // Define headers and row
    const headers = ["Receipt No", "Client", "Invoice", "Amount", "Mode", "Date"];
    const row = [
      payment.receiptNo,
      client.name,
      invoice ? invoice.invoiceNo : "-",
      `₹${payment.amount.toFixed(2)}`,
      payment.mode,
      new Date(payment.date).toLocaleDateString(),
    ];

    if (payment.slipRef) {
      headers.push("Reference");
      row.push(payment.slipRef);
    }
    if (payment.notes) {
      headers.push("Notes");
      row.push(payment.notes);
    }

    const startX = doc.x;
    const startY = doc.y;
    const colCount = headers.length;
    const pageWidth = doc.page.width - doc.options.margin * 2;
    const colWidth = pageWidth / colCount;
    const rowHeight = 25;

    // Draw header background
    doc.rect(startX, startY, pageWidth, rowHeight).fill("#f0f0f0");

    // Header text (black)
    doc.fillColor("#000000").font("Helvetica-Bold");
    headers.forEach((header, i) => {
      doc.text(header, startX + i * colWidth + 5, startY + 7, { width: colWidth - 10, align: "center" });
    });

    // Draw header border
    doc.rect(startX, startY, pageWidth, rowHeight).stroke("#000000");

    // Draw row background
    const rowY = startY + rowHeight;
    doc.rect(startX, rowY, pageWidth, rowHeight).fillOpacity(0.05).fill("#dddddd").fillOpacity(1);

    // Row text (black)
    doc.fillColor("#000000").font("Helvetica");
    row.forEach((cell, i) => {
      doc.text(cell, startX + i * colWidth + 5, rowY + 7, { width: colWidth - 10, align: "center" });
    });

    // Draw row border
    doc.rect(startX, rowY, pageWidth, rowHeight).stroke("#000000");

    doc.moveDown(3);

    // ----- Footer -----
    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor("#777777")
      .text("Thank you for your payment!", { align: "center" });

    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
};






