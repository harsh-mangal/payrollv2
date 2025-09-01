import Client from '../models/Client.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { generateLedgerPDF } from '../utils/pdf.js';
import path from 'path';

export const createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);
    // opening balance entry (if any)
    if (client.openingBalance && client.openingBalance !== 0) {
      await LedgerEntry.create({
        clientId: client._id,
        date: new Date(),
        type: client.openingBalance > 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(client.openingBalance),
        balanceAfter: client.openingBalance,
        refType: 'OPENING'
      });
    }
    res.json({ ok: true, client });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const listClients = async (_req, res) => {
  const list = await Client.find().sort({ createdAt: -1 });
  res.json({ ok: true, list });
};

export const getLedger = async (req, res) => {
  const { clientId } = req.params;
  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });
  const entries = await LedgerEntry.find({ clientId }).sort({ date: 1, createdAt: 1 });
  res.json({ ok: true, client, entries });
};

export const getLedgerPdf = async (req, res) => {
  const { clientId } = req.params;
  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ ok: false, error: 'CLIENT_NOT_FOUND' });
  const entries = await LedgerEntry.find({ clientId }).sort({ date: 1, createdAt: 1 });
  const outPath = path.resolve('uploads', `ledger-${clientId}.pdf`);
  await generateLedgerPDF({ client, entries }, outPath);
  res.json({ ok: true, url: `${process.env.BASE_URL}/uploads/${path.basename(outPath)}` });
};
