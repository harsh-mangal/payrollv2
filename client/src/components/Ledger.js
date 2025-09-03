import React, { useEffect } from "react";
import { inr } from "../lib/fmt";

export default function Ledger({ ledger, onExport, onRefresh }) {
  const runningBalance = (ledger?.entries || []).reduce((acc, e) => {
    return acc + (e.type === "CREDIT" ? -toNum(e.amount) : toNum(e.amount));
  }, 0);

  function toNum(v) {
    return v == null ? 0 : Number(v);
  }
 
  useEffect(()=>{
    console.log(ledger);
    
  },[])

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-600">
          Running balance: <b>{ledger ? inr(runningBalance) : "-"}</b>
        </div>
        <div className="flex gap-2">
          <button onClick={onExport} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300">Export PDF</button>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300">Refresh</button>
        </div>
      </div>

      <div className="max-h-80 overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Amount</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Balance</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Ref</th>
            </tr>
          </thead>
          <tbody>
            {(ledger?.entries || []).map((e) => (
              <tr key={e._id} className="hover:bg-slate-50 cursor-default">
                <td className="px-3 py-2 border-t">{new Date(e.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 border-t">{e.type}</td>
                <td className="px-3 py-2 border-t text-right">
                  {e.type === "CREDIT" ? `- ${inr(e.amount)}` : inr(e.amount)}
                </td>
                <td className="px-3 py-2 border-t text-right">{inr(e.balanceAfter)}</td>
                <td className="px-3 py-2 border-t">{e.refType || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
