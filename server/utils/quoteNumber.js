// server/utils/quoteNumber.js
import Quotation from "../models/Quotation.js";

// Very simple incrementor: QTN-0001, QTN-0002, ...
export async function nextQuoteNo() {
  const last = await Quotation.findOne().sort({ createdAt: -1 }).lean();
  if (!last || !last.quoteNo) return "QTN-0001";
  const m = last.quoteNo.match(/(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `QTN-${String(n).padStart(4, "0")}`;
}
