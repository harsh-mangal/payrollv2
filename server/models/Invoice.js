import mongoose from 'mongoose';

const LineItem = new mongoose.Schema({
  description: String,
  qty: { type: Number, default: 1 },
  // You can send EITHER of these depending on gstMode:
  unitPriceExclGst: { type: Number }, // used when gstMode === 'EXCLUSIVE' or 'NOGST'
  unitPriceInclGst: { type: Number },  // used when gstMode === 'INCLUSIVE'
  originalAmount: Number,
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Types.ObjectId, ref: 'Client', required: true },
  invoiceNo: { type: String, unique: true, required: true },
  issueDate: { type: Date, required: true },
  periodStart: Date,
  periodEnd: Date,

  lineItems: [LineItem],
  extraAmount: { type: Number, default: 0 },
  remarks: String,

  // NEW: GST mode per invoice
  gstMode: { type: String, enum: ['EXCLUSIVE', 'INCLUSIVE', 'NOGST'], default: 'EXCLUSIVE' },

  // Computed totals
  subtotalExclGst: Number,
  gstRate: Number,
  gstAmount: Number,
  totalInclGst: Number,

  paidAmount: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['DUE', 'PARTIALLY_PAID', 'PAID'], default: 'DUE' },
  pdfPath: String
}, { timestamps: true });

export default mongoose.model('Invoice', InvoiceSchema);
