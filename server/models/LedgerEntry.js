import mongoose from 'mongoose';

const LedgerEntry = new mongoose.Schema({
  clientId: { type: mongoose.Types.ObjectId, ref: 'Client', required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['DEBIT','CREDIT','ADJUSTMENT'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true }, // running balance (+ve = client owes you)
  refType: { type: String, enum: ['INVOICE','PAYMENT','OPENING','ADJUSTMENT'] },
  refId: { type: mongoose.Types.ObjectId },
  remarks: String
}, { timestamps: true });

export default mongoose.model('LedgerEntry', LedgerEntry);
