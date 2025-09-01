import Invoice from '../models/Invoice.js';
import path from 'path';
import { sendWhatsAppDocument } from '../utils/whatsapp.js';

export const whatsappLinkForInvoice = async (req, res) => {
  const inv = await Invoice.findById(req.params.invoiceId);
  if (!inv || !inv.pdfPath) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  const url = `${process.env.BASE_URL}/uploads/${path.basename(inv.pdfPath)}`;
  // simple wa.me share (manual send)
  const text = encodeURIComponent(`Invoice ${inv.invoiceNo}\n${url}`);
  const wa = `https://wa.me/${process.env.WHATSAPP_MY_NUMBER || ''}?text=${text}`;
  res.json({ ok: true, shareUrl: wa, fileUrl: url });
};

export const whatsappSendInvoice = async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.invoiceId);
    if (!inv || !inv.pdfPath) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    const fileUrl = `${process.env.BASE_URL}/uploads/${path.basename(inv.pdfPath)}`;
    const to = process.env.WHATSAPP_MY_NUMBER;
    const data = await sendWhatsAppDocument({ fileUrl, filename: `${inv.invoiceNo}.pdf`, to });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
