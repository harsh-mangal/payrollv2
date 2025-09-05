import React, { useEffect, useState } from "react";
import Select from "react-select";
import { apiPostForm, apiGet } from "../lib/api"; // make sure you have an apiGet to fetch payments

export default function Payments({ baseUrl, clients, selectedClientId, showToast, onAnyChange }) {
  const [form, setForm] = useState({
    clientId: "",
    invoiceId: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    mode: "UPI",
    slipRef: "",
    notes: "",
    slip: null,
  });
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    setForm((f) => ({ ...f, clientId: selectedClientId || f.clientId }));
  }, [selectedClientId]);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const data = await apiGet(baseUrl, "/payments"); // endpoint should return all payments
      setPayments(data);
    } catch (e) {
      showToast({ type: "error", text: "Failed to fetch payments" });
    }
  };

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

      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank");
      }

      setForm((f) => ({ ...f, amount: "", slipRef: "", notes: "", slip: null }));
      onAnyChange && onAnyChange();
      fetchPayments(); // refresh table
    } catch (e) {
      showToast({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const clientOptions = clients.map((c) => ({ value: c._id, label: c.name }));

  const paymentModes = [
    { value: "CASH", label: "CASH" },
    { value: "UPI", label: "UPI" },
    { value: "NEFT", label: "NEFT" },
    { value: "IMPS", label: "IMPS" },
    { value: "RTGS", label: "RTGS" },
    { value: "CARD", label: "CARD" },
    { value: "CHEQUE", label: "CHEQUE" },
    { value: "OTHER", label: "OTHER" },
  ];

  return (
    <div className="space-y-4">
      {/* Payment form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        <Select
          options={paymentModes}
          value={paymentModes.find((m) => m.value === form.mode)}
          onChange={(selected) => setForm({ ...form, mode: selected?.value || "" })}
          placeholder="Select payment mode…"
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

      {/* Payments table */}
      <div className="pt-6">
  {/* Desktop Table */}
  <div className="hidden md:overflow-x-auto md:block">
    <table className="min-w-full text-sm rounded-2xl border border-gray-200">
      <thead className="bg-indigo-50">
        <tr>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium rounded-tl-lg">Receipt No</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium">Client</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium">Invoice</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium">Amount</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium">Mode</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium">Date</th>
          <th className="px-4 py-3 text-left text-indigo-800 font-medium rounded-tr-lg">Action</th>
        </tr>
      </thead>
      <tbody className="bg-gray-50">
        {payments.map((p) => (
          <tr key={p._id} className="border-b border-gray-200">
            <td className="px-4 py-3 font-medium text-gray-700">{p.receiptNo}</td>
            <td className="px-4 py-3 text-gray-700">{p.clientName}</td>
            <td className="px-4 py-3 text-gray-700">{p.invoiceNo || "-"}</td>
            <td className="px-4 py-3 text-gray-700">{p.amount.toFixed(2)}</td>
            <td className="px-4 py-3 text-gray-700">{p.mode}</td>
            <td className="px-4 py-3 text-gray-700">{new Date(p.date).toLocaleDateString()}</td>
            <td className="px-4 py-3">
              {p.pdfUrl && (
                <button
                  onClick={() => window.open(p.pdfUrl, "_blank")}
                  className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline transition-colors"
                >
                  View PDF
                </button>
              )}
            </td>
          </tr>
        ))}
        {payments.length === 0 && (
          <tr>
            <td colSpan={7} className="text-center py-6 text-gray-400 italic">
              No payments recorded yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  {/* Mobile Card Layout */}
  <div className="md:hidden space-y-4">
    {payments.length === 0 && (
      <div className="text-center py-6 text-gray-400 italic">No payments recorded yet.</div>
    )}
    {payments.map((p) => (
      <div key={p._id} className="bg-white shadow rounded-lg p-4">
        <div className="flex justify-between mb-1">
          <span className="font-medium text-gray-700">Receipt:</span>
          <span className="text-gray-700">{p.receiptNo}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="font-medium text-gray-700">Client:</span>
          <span className="text-gray-700">{p.clientName}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="font-medium text-gray-700">Amount:</span>
          <span className="text-gray-700">{p.amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="font-medium text-gray-700">Mode:</span>
          <span className="text-gray-700">{p.mode}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="font-medium text-gray-700">Date:</span>
          <span className="text-gray-700">{new Date(p.date).toLocaleDateString()}</span>
        </div>
        {p.pdfUrl && (
          <button
            onClick={() => window.open(p.pdfUrl, "_blank")}
            className="text-indigo-600 font-medium hover:text-indigo-800 hover:underline transition-colors"
          >
            View PDF
          </button>
        )}
      </div>
    ))}
  </div>
</div>



    </div>
  );
}
