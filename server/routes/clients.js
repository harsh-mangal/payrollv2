import { Router } from 'express';
import {
  createClient, listClients, getAllClientsLedger,
  getLedger, getLedgerPdf,
  addClientCredential, listClientCredentials, updateClientCredential, deleteClientCredential,
  addClientMeeting, listClientMeetings, updateMeetingActionItem,
  getClientById, addClientService,
} from '../controllers/clientController.js';

const r = Router();

r.post('/', createClient);
r.get('/', listClients);

// single client + services
r.get('/:clientId', getClientById);
r.post('/:clientId/services', addClientService);

// ledger
r.get('/:clientId/ledger', getLedger);
r.get('/:clientId/ledger/pdf', getLedgerPdf);
r.get('/_all/ledgers', getAllClientsLedger);

// credentials
r.post('/:clientId/credentials', addClientCredential);
r.get('/:clientId/credentials', listClientCredentials);
r.patch('/:clientId/credentials/:credId', updateClientCredential);
r.delete('/:clientId/credentials/:credId', deleteClientCredential);

// meetings
r.post('/:clientId/meetings', addClientMeeting);
r.get('/:clientId/meetings', listClientMeetings);
r.patch('/:clientId/meetings/:meetingId/action-items/:index', updateMeetingActionItem);

export default r;
