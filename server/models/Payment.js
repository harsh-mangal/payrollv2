import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  clientId: { type: mongoose.Types.ObjectId, ref: 'Client', required: true },
  invoiceId: { type: mongoose.Types.ObjectId, ref: 'Invoice' }, // optional (advance allowed)
  date: { type: Date, required: true },
  amount: { type: Number, required: true },       // received amount
  mode: { type: String, enum: ['CASH','UPI','NEFT','IMPS','RTGS','CARD','CHEQUE','OTHER'], default: 'OTHER' },
  slipRef: String,              // payment slip number / reference
  notes: String,
  attachmentPath: String ,       // uploaded slip image/pdf
  receiptNo: { type: String, required: true, unique: true },

}, { timestamps: true });

export default mongoose.model('Payment', PaymentSchema);
