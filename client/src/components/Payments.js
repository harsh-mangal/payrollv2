import React, { useEffect, useState } from "react";
import Select from "react-select";
import { apiPostForm } from "../lib/api";

export default function Payments({ baseUrl, clients, selectedClientId, showToast, onAnyChange }) {
  const [form, setForm] = useState({
    clientId: "",
    invoiceId: "",
    date: new Date().toISOString().slice(0,10),
    amount: "",
    mode: "UPI",
    slipRef: "",
    notes: "",
    slip: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, clientId: selectedClientId || f.clientId }));
  }, [selectedClientId]);

  const submit = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("clientId", form.clientId || selectedClientId);
      if (form.invoiceId) fd.append("invoiceId", form.invoiceId);
      fd.append("date", form.date);
      fd.append("amount", String(form.amount || ""));
      fd.append("mode", form.mode);
      if (form.slipRef) fd.append("slipRef", form.slipRef);
      if (form.notes) fd.append("notes", form.notes);
      if (form.slip) fd.append("slip", form.slip);

      const data = await apiPostForm(baseUrl, "/payments", fd);
      showToast({ type: "success", text: data.isAdvance ? "Advance recorded" : "Payment recorded" });
      setForm((f) => ({ ...f, amount: "", slipRef: "", notes: "", slip: null }));
      onAnyChange && onAnyChange();
    } catch (e) {
      showToast({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => ({ value: c._id, label: c.name }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Client dropdown with react-select */}
      <Select
        options={clientOptions}
        value={clientOptions.find((o) => o.value === (form.clientId || selectedClientId))}
        onChange={(selected) => setForm({ ...form, clientId: selected?.value || "" })}
        placeholder="Select client…"
        menuPlacement="auto"
        menuPosition="fixed"
        className="text-sm w-full"
        styles={{
          control: (base, state) => ({
            ...base,
            borderRadius: "0.5rem",
            borderColor: state.isFocused ? "#6366f1" : "#d1d5db",
            boxShadow: state.isFocused ? "0 0 0 2px #6366f1" : "none",
            padding: "2px 4px",
            "&:hover": { borderColor: "#6366f1" },
          }),
          menu: (base) => ({ ...base, zIndex: 50 }),
        }}
      />

      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
      />
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        placeholder="Invoice ID (optional)"
        value={form.invoiceId}
        onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}
      />
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        type="number"
        step="0.01"
        placeholder="Amount"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />

      {/* Payment mode dropdown (keep native select) */}
      <select
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        value={form.mode}
        onChange={(e) => setForm({ ...form, mode: e.target.value })}
      >
        {["CASH", "UPI", "NEFT", "IMPS", "RTGS", "CARD", "CHEQUE", "OTHER"].map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        placeholder="Slip Ref"
        value={form.slipRef}
        onChange={(e) => setForm({ ...form, slipRef: e.target.value })}
      />
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:col-span-2"
        placeholder="Notes"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:col-span-2"
        type="file"
        onChange={(e) => setForm({ ...form, slip: e.target.files?.[0] || null })}
      />
      <div className="md:col-span-2">
        <button
          onClick={submit}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
        >
          {saving ? "Saving…" : "Record Payment"}
        </button>
      </div>
    </div>
  );
}
