import { Router } from 'express';
import { createInvoice, getInvoicePdf } from '../controllers/invoiceController.js';

const r = Router();
r.post('/', createInvoice);
r.get('/:invoiceId/pdf', getInvoicePdf);
export default r;
