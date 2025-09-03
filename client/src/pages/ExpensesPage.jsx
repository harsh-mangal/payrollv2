// src/pages/ExpensesPage.jsx
import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import Select from "react-select"; // <-- react-select

// ------- helpers -------
const parseAmount = (v) => {
  if (v === "" || v == null) return 0;
  let s = String(v).trim();

  // If there's a comma but no dot, treat comma as decimal separator
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");

  // Remove likely thousands separators/spaces (1,234.56 or 1 234.56)
  s = s.replace(/[\s,](?=(\d{3})+(\.|$))/g, "");

  // Strip currency and any non-numeric chars (keep digits, dot, minus)
  s = s.replace(/[^\d.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export default function ExpensesPage({ baseUrl, showToast = () => {} }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [form, setForm] = useState({
    name: "",
    amount: "",
    mode: "OTHER",
    paymentTo: "",
    date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const q = [];
      if (from) q.push(`from=${from}`);
      if (to) q.push(`to=${to}`);
      const data = await apiGet(
        baseUrl,
        `/expenses${q.length ? "?" + q.join("&") : ""}`
      );
      if (!data?.ok) throw new Error(data?.error || "Failed");
      setList(data.expenses || []);
    } catch (e) {
      showToast({ type: "error", text: e.message || "Load error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createExpense() {
    try {
      const amt = parseAmount(form.amount);
      const name = (form.name || "").trim();

      if (!name || !(amt > 0)) {
        showToast({ type: "error", text: "Enter name and positive amount" });
        return;
      }

      setCreating(true);
      const payload = {
        name,
        amount: amt,
        mode: form.mode,
        paymentTo: form.paymentTo || undefined,
        date: form.date || undefined,
        remarks: form.remarks || undefined,
      };
      const data = await apiPost(baseUrl, "/expenses", payload);
      if (!data?.ok) throw new Error(data?.error || "Create failed");

      showToast({ type: "success", text: "Expense added" });
      setForm({
        name: "",
        amount: "",
        mode: "OTHER",
        paymentTo: "",
        date: new Date().toISOString().slice(0, 10),
        remarks: "",
      });
      load();
    } catch (e) {
      showToast({ type: "error", text: e.message || "Create error" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Add Expense Form */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="text-sm font-medium mb-2">Add Expense</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Text
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <AmountInput
            label="Amount"
            value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })}
            placeholder="e.g. 1,234.50"
          />
          <SelectField
            label="Mode"
            value={form.mode}
            onChange={(v) => setForm({ ...form, mode: v })}
            options={["OTHER", "CASH", "BANK", "UPI", "CARD"]}
          />
          <Text
            label="Payment To"
            value={form.paymentTo}
            onChange={(v) => setForm({ ...form, paymentTo: v })}
          />
          <DateInput
            label="Date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <Text
            label="Remarks"
            value={form.remarks}
            onChange={(v) => setForm({ ...form, remarks: v })}
          />
        </div>
        <div className="mt-3">
          <button
            onClick={createExpense}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {creating ? "Saving…" : "Save Expense"}
          </button>
        </div>
      </div>

      {/* Expense List */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-end justify-between gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <DateInput label="From" value={from} onChange={setFrom} />
            <DateInput label="To" value={to} onChange={setTo} />
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-slate-50">
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Payment To</th>
                <th className="py-2 px-2">Mode</th>
                <th className="py-2 px-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td className="py-3 px-2" colSpan={5}>
                    No expenses
                  </td>
                </tr>
              ) : (
                list.map((e) => (
                  <tr key={e._id} className="border-t">
                    <td className="py-2 px-2">
                      {new Date(e.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-2">{e.name}</td>
                    <td className="py-2 px-2">{e.paymentTo || "-"}</td>
                    <td className="py-2 px-2">{e.mode}</td>
                    <td className="py-2 px-2 text-right">
                      {Number(e.amount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* --------- field components ---------- */

function Text({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function AmountInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text" // allows commas & various formats
        inputMode="decimal" // better mobile keyboard
        pattern="[0-9.,-]*"
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="date"
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// New react-select field
function SelectField({ label, value, onChange, options = [] }) {
  const selectOptions = options.map((o) => ({ value: o, label: o }));
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <Select
        className="text-sm"
        options={selectOptions}
        value={selectOptions.find((opt) => opt.value === value)}
        onChange={(opt) => onChange(opt ? opt.value : "")}
        placeholder={`Select ${label.toLowerCase()}…`}
        isClearable
      />
    </div>
  );
}
