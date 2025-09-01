import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";

export default function BalancePage({ baseUrl, showToast = () => {} }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const q = [];
      if (from) q.push(`from=${from}`);
      if (to) q.push(`to=${to}`);
      const res = await apiGet(baseUrl, `/reports/net-balance${q.length ? "?" + q.join("&") : ""}`);
      if (!res?.ok) throw new Error(res?.error || "Failed");
      setData(res);
    } catch (e) {
      showToast({ type: "error", text: e.message || "Load error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Client Payments (In)", value: data.inflows.clientPayments },
      { label: "Expenses (Out)", value: data.outflows.expenses },
      { label: "Salaries Net (Out)", value: data.outflows.salariesNet },
      { label: "Total Inflows", value: data.totals.inflows },
      { label: "Total Outflows", value: data.totals.outflows },
      { label: "Net (In - Out)", value: data.totals.net },
    ];
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <DateInput label="From" value={from} onChange={setFrom}/>
          <DateInput label="To" value={to} onChange={setTo}/>
        </div>
        <div className="mt-3">
          <button onClick={load}
            className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="border rounded-xl p-4 bg-slate-50">
                <div className="text-xs text-slate-600">{c.label}</div>
                <div className="text-xl font-semibold">₹ {Number(c.value || 0).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="border rounded-xl p-4 bg-white">
            <div className="text-sm font-medium mb-2">Staff Advances (Info)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border rounded-lg p-3 bg-slate-50">
                <div className="text-xs text-slate-600">Advance Given</div>
                <div className="text-lg font-semibold">₹ {Number(data.staffAdvances.given || 0).toFixed(2)}</div>
              </div>
              <div className="border rounded-lg p-3 bg-slate-50">
                <div className="text-xs text-slate-600">Advance Recovered</div>
                <div className="text-lg font-semibold">₹ {Number(data.staffAdvances.recovered || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input type="date" className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        value={value ?? ""} onChange={(e)=>onChange(e.target.value)} />
    </div>
  );
}
