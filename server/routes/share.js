import { Router } from 'express';
import { whatsappLinkForInvoice, whatsappSendInvoice } from '../controllers/shareController.js';

const r = Router();
// 1) Get a wa.me link to share to WhatsApp manually
r.get('/whatsapp/invoice/:invoiceId', whatsappLinkForInvoice);

// 2) Auto-send via WhatsApp Cloud API (needs .env token)
r.post('/whatsapp/invoice/:invoiceId', whatsappSendInvoice);

export default r;
