import PDFDocument from 'pdfkit';
import fs from 'fs';
import dayjs from 'dayjs';

const money = (n) => (Number(n) || 0).toFixed(2);

export async function generateSalarySlipPDF({ staff, payment, org = {} }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Header
    doc.font('Helvetica-Bold').fontSize(16).text(org.name || 'Salary Slip', { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#666')
      .text(org.address || '', { align: 'center' })
      .text(org.phone ? `Phone: ${org.phone}` : '', { align: 'center' })
      .text(org.email ? `Email: ${org.email}` : '', { align: 'center' });
    doc.moveDown();

    // Meta
    const monthName = dayjs(`${payment.year}-${String(payment.month).padStart(2,'0')}-01`).format('MMMM YYYY');
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text('Employee Details');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Name: ${staff.name || ''}`);
    if (staff.designation) doc.text(`Designation: ${staff.designation}`);
    if (staff.joinDate) doc.text(`Joining: ${dayjs(staff.joinDate).format('DD MMM YYYY')}`);
    if (staff.phone) doc.text(`Phone: ${staff.phone}`);
    if (staff.email) doc.text(`Email: ${staff.email}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('Salary Details');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Slip No: ${payment.slipNo || '-'}`);
    doc.text(`Month: ${monthName}`);
    doc.text(`Paid On: ${dayjs(payment.paidOn).format('DD MMM YYYY')}`);
    doc.text(`Mode: ${payment.payMode || 'OTHER'}`);
    if (payment.remarks) doc.text(`Remarks: ${payment.remarks}`);
    doc.moveDown();

    // Earnings / Deductions table
    const left = 36;
    const right = doc.page.width - 36;
    const mid = (left + right) / 2;

    doc.font('Helvetica-Bold').text('Earnings', left, doc.y);
    doc.text('Deductions', mid, doc.y);
    doc.moveDown(0.5);

    const earn = [
      ['Basic', money(payment.basic)],
      ['HRA', money(payment.hra)],
      ['Other Allowances', money(payment.otherAllowances)],
      ['Gross', money(payment.gross)],
    ];

    const ded = [
      ['PF', money(payment.pf)],
      ['TDS', money(payment.tds)],
      ['Advance Recovery', money(payment.advanceRecovery)],
      ['Other Deductions', money(payment.otherDeductions)],
      ['Total Deductions', money(payment.totalDeductions)],
    ];

    const rowHeight = 16;
    let y = doc.y;
    const colW = (right - left) / 2 - 10;

    earn.forEach(([k, v], i) => {
      doc.font('Helvetica').text(`${k}`, left, y, { width: colW });
      doc.text(`${v}`, left + colW - 80, y, { width: 80, align: 'right' });
      y += rowHeight;
    });

    // Reset y to start for deductions
    let y2 = doc.y - rowHeight * earn.length;
    ded.forEach(([k, v]) => {
      doc.font('Helvetica').text(`${k}`, mid, y2, { width: colW });
      doc.text(`${v}`, mid + colW - 80, y2, { width: 80, align: 'right' });
      y2 += rowHeight;
    });

    // Net Pay
    const finalY = Math.max(y, y2) + 10;
    doc.moveTo(left, finalY).lineTo(right, finalY).strokeColor('#ddd').stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(`NET PAY: ₹ ${money(payment.netPay)}`, left, finalY + 10);

    // Footer note
    doc.font('Helvetica').fontSize(9).fillColor('#777');
    doc.text('This is a computer-generated salary slip. No signature required.', left, doc.page.height - 50, { width: right - left, align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}
