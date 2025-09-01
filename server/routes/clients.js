import { Router } from 'express';
import { createClient, listClients, getLedger, getLedgerPdf } from '../controllers/clientController.js';

const r = Router();
r.post('/', createClient);
r.get('/', listClients);
r.get('/:clientId/ledger', getLedger);
r.get('/:clientId/ledger/pdf', getLedgerPdf);
export default r;
