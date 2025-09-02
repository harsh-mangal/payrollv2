import Payment from "../models/Payment.js";
import Expense from "../models/Expense.js";
import SalaryPayment from "../models/SalaryPayment.js";
import StaffLedgerEntry from "../models/StaffLedgerEntry.js";

// Helper to get YYYY-MM string
const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
};

// Helper to aggregate by month
const aggregateByMonth = async (Model, dateField, sumField, match = {}) => {
  const result = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: `$${dateField}` } },
        total: { $sum: `$${sumField}` },
      },
    },
    { $sort: { "_id": 1 } },
  ]);
  const obj = {};
  result.forEach((r) => (obj[r._id] = r.total));
  return obj;
};

export const netBalance = async (req, res) => {
  try {
    const { month } = req.query; // e.g., "2025-09"

    // Calculate startDate and endDate based on month string
    let startDate, endDate;
    if (month) {
      const [year, mon] = month.split("-").map(Number);
      startDate = new Date(year, mon - 1, 1);
      endDate = new Date(year, mon, 0, 23, 59, 59, 999); // last day of month
    } else {
      startDate = new Date("1970-01-01");
      endDate = new Date("3000-01-01");
    }

    const rangeMatch = { $gte: startDate, $lte: endDate };

    // Aggregate payments, expenses, salaries
    const payments = await aggregateByMonth(Payment, "date", "amount", { date: rangeMatch });
    const expenses = await aggregateByMonth(Expense, "date", "amount", { date: rangeMatch });
    const salaries = await aggregateByMonth(SalaryPayment, "paidOn", "netPay", { paidOn: rangeMatch });

    // Aggregate staff advances
    const staffAdvEntries = await StaffLedgerEntry.find({ date: rangeMatch });
    const advGiven = {};
    const advRec = {};
    staffAdvEntries.forEach((entry) => {
      const key = getMonthKey(entry.date);
      if (entry.type === "DEBIT" && entry.refType === "ADVANCE") advGiven[key] = (advGiven[key] || 0) + entry.amount;
      if (entry.type === "CREDIT" && entry.refType === "RECOVERY") advRec[key] = (advRec[key] || 0) + entry.amount;
    });

    // Build set of all months present in any category
    const monthsSet = new Set([
      ...Object.keys(payments),
      ...Object.keys(expenses),
      ...Object.keys(salaries),
      ...Object.keys(advGiven),
      ...Object.keys(advRec),
    ]);
    const months = Array.from(monthsSet).sort();

    // Build report
    const report = months.map((m) => {
      const inflow = payments[m] || 0;
      const outflow = (expenses[m] || 0) + (salaries[m] || 0);
      return {
        month: m,
        inflows: { clientPayments: inflow },
        outflows: { expenses: expenses[m] || 0, salariesNet: salaries[m] || 0 },
        staffAdvances: { given: advGiven[m] || 0, recovered: advRec[m] || 0 },
        totals: { inflows: inflow, outflows: outflow, net: inflow - outflow },
      };
    });

    res.json({ ok: true, report });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};
