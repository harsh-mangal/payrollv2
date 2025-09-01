import dayjs from 'dayjs';
import Counter from '../models/Counter.js';

export async function nextInvoiceNo() {
  const yyyymm = dayjs().format('YYYYMM');
  const key = `INV-${yyyymm}`;
  const ct = await Counter.findOneAndUpdate(
    { key }, { $inc: { seq: 1 } }, { upsert: true, new: true }
  );
  const num = String(ct.seq).padStart(4,'0');
  return `${key}-${num}`; // e.g., INV-202509-0001
}
