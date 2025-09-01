import Payment from "../models/Payment.js";
import Expense from "../models/Expense.js";
import SalaryPayment from "../models/SalaryPayment.js";
import StaffLedgerEntry from "../models/StaffLedgerEntry.js";

const endOfDay = (d) => {
  const t = new Date(d);
  t.setHours(23, 59, 59, 999);
  return t;
};

export const netBalance = async (req, res) => {
  try {
    const { from, to } = req.query;
    const hasRange = from || to;
    const range = hasRange
      ? { $gte: from ? new Date(from) : new Date("1970-01-01"), $lte: to ? endOfDay(to) : new Date() }
      : undefined;

    // Incoming cash: client payments
    const payMatch = hasRange ? { date: range } : {};
    const paymentsAgg = await Payment.aggregate([
      { $match: payMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const incomePayments = Number(paymentsAgg[0]?.total || 0);

    // Outgoing: expenses
    const expMatch = hasRange ? { date: range } : {};
    const expensesAgg = await Expense.aggregate([
      { $match: expMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = Number(expensesAgg[0]?.total || 0);

    // Outgoing: salaries (net pay)
    const salMatch = hasRange ? { paidOn: range } : {};
    const salariesAgg = await SalaryPayment.aggregate([
      { $match: salMatch },
      { $group: { _id: null, total: { $sum: "$netPay" } } },
    ]);
    const totalSalaries = Number(salariesAgg[0]?.total || 0);

    // Optional: Staff advances given (DEBIT) minus recoveries (CREDIT) within range — informational
    const ledMatch = hasRange ? { date: range } : {};
    const advDebAgg = await StaffLedgerEntry.aggregate([
      { $match: { ...ledMatch, type: "DEBIT", refType: "ADVANCE" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const advRecAgg = await StaffLedgerEntry.aggregate([
      { $match: { ...ledMatch, type: "CREDIT", refType: "RECOVERY" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const advancesGiven = Number(advDebAgg[0]?.total || 0);
    const advancesRecovered = Number(advRecAgg[0]?.total || 0);

    // Net = Inflows - Outflows
    const totalOutflows = totalExpenses + totalSalaries;
    const net = incomePayments - totalOutflows;

    res.json({
      ok: true,
      from: from || null,
      to: to || null,
      inflows: {
        clientPayments: incomePayments,
      },
      outflows: {
        expenses: totalExpenses,
        salariesNet: totalSalaries,
      },
      staffAdvances: {
        given: advancesGiven,
        recovered: advancesRecovered,
      },
      totals: {
        inflows: incomePayments,
        outflows: totalOutflows,
        net,
      },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
