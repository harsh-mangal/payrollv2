import React, { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function BalancePage({ baseUrl, showToast = () => {} }) {
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const q = month ? `?month=${month}` : "";
      const res = await apiGet(baseUrl, `/reports/net-balance${q}`);
      if (!res?.ok) throw new Error(res?.error || "Failed");
      setData(res);
    } catch (e) {
      showToast({ type: "error", text: e.message || "Load error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const sortedReport =
    data?.report?.slice().sort((a, b) => (a.month < b.month ? 1 : -1)) || [];

  return (
    <div className="space-y-6">
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <MonthInput label="Select Month" value={month} onChange={setMonth} />
        </div>
      </div>

      {sortedReport.map((monthData) => (
        <div key={monthData.month} className="border rounded-xl p-4 bg-white">
          <div className="text-sm font-medium mb-2">
            {new Date(`${monthData.month}-01`).toLocaleString("default", { month: "long", year: "numeric" })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Card label="Client Payments (In)" value={monthData.inflows?.clientPayments} />
            <Card label="Expenses (Out)" value={monthData.outflows?.expenses} />
            <Card label="Salaries Net (Out)" value={monthData.outflows?.salariesNet} />
            <Card label="Total Inflows" value={monthData.totals?.inflows} />
            <Card label="Total Outflows" value={monthData.totals?.outflows} />
            <Card label="Net (In - Out)" value={monthData.totals?.net} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card label="Advance Given" value={monthData.staffAdvances?.given} />
            <Card label="Advance Recovered" value={monthData.staffAdvances?.recovered} />
          </div>
        </div>
      ))}

      {loading && <div className="text-center text-slate-500">Loading reports…</div>}
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="border rounded-xl p-4 bg-slate-50">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-xl font-semibold">₹ {Number(value || 0).toFixed(2)}</div>
    </div>
  );
}

function MonthInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="month"
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
