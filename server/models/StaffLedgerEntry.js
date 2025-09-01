import mongoose from 'mongoose';

// From company perspective:
//  - DEBIT  = money paid to staff (advance/salary/etc.)
//  - CREDIT = recovery/deduction (advance recovery, fine, etc.)
const StaffLedgerEntrySchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true }, // running balance (debits - credits)

    refType: { type: String, enum: ['ADVANCE', 'SALARY', 'ADJUSTMENT', 'RECOVERY', 'OTHER'] },
    refId: { type: mongoose.Types.ObjectId }, // e.g., SalaryPayment _id

    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('StaffLedgerEntry', StaffLedgerEntrySchema);
