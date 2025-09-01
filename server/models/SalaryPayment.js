import mongoose from 'mongoose';

const SalaryPaymentSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Types.ObjectId, ref: 'Staff', required: true },
    month: { type: Number, required: true },   // 1..12
    year: { type: Number, required: true },

    // Components (customizable)
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },

    // Deductions
    pf: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    advanceRecovery: { type: Number, default: 0 }, // will create CREDIT in staff ledger
    otherDeductions: { type: Number, default: 0 },

    gross: { type: Number, required: true }, // computed = basic + hra + otherAllowances
    totalDeductions: { type: Number, required: true }, // computed = pf+tds+advanceRecovery+otherDeductions
    netPay: { type: Number, required: true }, // computed = gross - totalDeductions

    paidOn: { type: Date, default: Date.now },
    payMode: { type: String, enum: ['CASH', 'BANK', 'UPI', 'OTHER'], default: 'OTHER' },
    slipPath: { type: String }, // PDF path
    slipNo: { type: String },   // optional: like "SAL-2025-00012"
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

SalaryPaymentSchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('SalaryPayment', SalaryPaymentSchema);
