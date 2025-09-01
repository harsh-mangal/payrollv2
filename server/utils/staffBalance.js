import StaffLedgerEntry from '../models/StaffLedgerEntry.js';

export async function getStaffCurrentBalance(staffId) {
  const last = await StaffLedgerEntry.find({ staffId })
    .sort({ date: -1, createdAt: -1, _id: -1 })
    .limit(1);
  return last.length ? Number(last[0].balanceAfter || 0) : 0;
}
    