import mongoose from 'mongoose';

const StaffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    designation: { type: String, trim: true },
    joinDate: { type: Date },
    salaryBase: { type: Number, default: 0 },     // agreed monthly CTC or base
    bankAccount: {
      bankName: String,
      accountNo: String,
      ifsc: String,
      holderName: String,
    },
    upiId: { type: String, trim: true },
    notes: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Staff', StaffSchema);
