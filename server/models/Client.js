import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  kind: { type: String, enum: ['HOSTING','DIGITAL_MARKETING','OTHER'], required: true },
  amountMonthly: { type: Number, default: 0 }, // GST-exclusive
  amountOneTime: { type: Number, default: 0 }, // GST-exclusive
  billingType: { type: String, enum: ['MONTHLY','ONE_TIME'], required: true },
  startDate: { type: Date, required: true },
  expiryDate: { type: Date }, // for hosting/DM with validity
  notes: String
}, { _id: false });

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
  address: String,
  gstin: String,
  services: [ServiceSchema],
  openingBalance: { type: Number, default: 0 }, // +ve means client owes you
}, { timestamps: true });

export default mongoose.model('Client', ClientSchema);
