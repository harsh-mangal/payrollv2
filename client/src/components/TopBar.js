import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopBar({
  clients,
  selectedClientId,
  setSelectedClientId,
  onOpenLedgerPdf,
  onReloadLedger,
}) {
  const location = useLocation();

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm ${
        location.pathname.startsWith(to)
          ? "bg-indigo-600 text-white"
          : "bg-slate-200 text-slate-800 hover:bg-slate-300"
      }`}
    >
      {label}
    </Link>
  );

  // Show client controls only on client-centric pages
  const showClientControls = ["/clients", "/invoices", "/payments", "/ledger"].some((p) =>
    location.pathname.startsWith(p)
  );

  const selected = clients.find((c) => c._id === selectedClientId);

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* Left: navigation */}
      <div className="flex flex-wrap gap-2">
        {navLink("/clients", "Clients")}
        {navLink("/invoices", "Invoices")}
        {navLink("/payments", "Payments")}
        {navLink("/ledger", "Ledger")}
        {navLink("/staff", "Staff & Payroll")}
        {navLink("/expenses", "Expenses")}
        {navLink("/balance", "Net Balance")}
      </div>

      {/* Right: client-specific controls */}
      {showClientControls && clients?.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="text-sm">
            <span className="font-medium">Selected client: </span>
            {selected ? (
              <span className="text-indigo-700">{selected.name}</span>
            ) : (
              <span className="text-slate-500">None</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              className="px-2 py-1 border border-gray-300 rounded-lg text-sm min-w-[220px]"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId?.(e.target.value)}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={onOpenLedgerPdf}
              disabled={!selectedClientId}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm hover:bg-black disabled:opacity-50"
            >
              Ledger PDF
            </button>

            <button
              onClick={onReloadLedger}
              className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
            >
              Reload Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
