import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },     // e.g., "Facebook Ads", "AWS", "Office Rent"
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["CASH", "BANK", "UPI", "CARD", "OTHER"], default: "OTHER" },
    paymentTo: { type: String, trim: true },                // vendor/supplier/person
    date: { type: Date, default: Date.now },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);
