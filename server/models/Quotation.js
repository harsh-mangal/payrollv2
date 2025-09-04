// server/models/Quotation.js
import mongoose from "mongoose";

const QuotationItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    qty: { type: Number, default: 1 },
    // Enter one of these depending on gstMode:
    unitPriceExclGst: { type: Number }, // for EXCLUSIVE / NOGST
    unitPriceInclGst: { type: Number }, // for INCLUSIVE
    BillingType: { type: String, enum: ["ONE_TIME", "MONTHLY"], default: "ONE_TIME" },
    discount: { type: Number, default: 0 },
    originalAmount: Number,             // optional reference value
  },
  { _id: false }
);

const RecipientSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    company: String,
    address: String,
  },
  { _id: false }
);

const QuotationSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client" }, // optional but recommended
    quoteNo: { type: String, unique: true, index: true, required: true },

    issueDate: { type: Date, default: () => new Date() },
    validUntil: { type: Date }, // optional validity/expiry

    recipient: RecipientSchema, // "to whom" details
   

    lineItems: { type: [QuotationItemSchema], default: [] },
    extraAmount: { type: Number, default: 0 },

    gstMode: { type: String, enum: ["EXCLUSIVE", "INCLUSIVE", "NOGST"], default: "EXCLUSIVE" },
    gstRate: { type: Number, default: Number(process.env.GST_RATE || 0.18) },

    subtotalExclGst: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    totalInclGst: { type: Number, required: true },

    terms: String,
    notes: String,

    status: {
      type: String,
      enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "DRAFT",
      index: true,
    },

    pdfPath: String,

    sentTo: { type: [String], default: [] },
    sentAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Quotation", QuotationSchema);
