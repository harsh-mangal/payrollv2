// server/utils/paymentNumber.js
import Payment from "../models/Payment.js";


export async function nextPaymentNo() {
  const last = await Payment.findOne().sort({ createdAt: -1 }).lean();
  if (!last || !last.receiptNo) return "pay_1";

  // find trailing number
  const m = last.receiptNo.match(/(\d+)$/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;

  return `pay_${n}`;
}
