import Expense from "../models/Expense.js";

const toDate = (s) => (s ? new Date(s) : undefined);

export const createExpense = async (req, res) => {
  try {
    const { name, amount, mode = "OTHER", paymentTo, date, remarks } = req.body;
    if (!name || Number(amount) <= 0) {
      return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
    }
    const exp = await Expense.create({
      name: name.trim(),
      amount: Number(amount),
      mode,
      paymentTo: (paymentTo || "").trim() || undefined,
      date: toDate(date) || new Date(),
      remarks,
    });
    res.json({ ok: true, expense: exp });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const listExpenses = async (req, res) => {
  try {
    const { from, to } = req.query;
    const q = {};
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(from);
      if (to) {
        const t = new Date(to);
        // make 'to' inclusive end-of-day
        t.setHours(23, 59, 59, 999);
        q.date.$lte = t;
      }
    }
    const rows = await Expense.find(q).sort({ date: -1, createdAt: -1 });
    res.json({ ok: true, expenses: rows });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const row = await Expense.findByIdAndDelete(expenseId);
    if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
