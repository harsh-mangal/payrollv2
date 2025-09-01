import LedgerEntry from '../models/LedgerEntry.js';

export async function getCurrentBalance(clientId) {
  const last = await LedgerEntry.find({ clientId })
    .sort({ date: -1, createdAt: -1 })
    .limit(1);
  return last[0]?.balanceAfter ?? 0; // +ve = receivable, -ve = advance with you
}
