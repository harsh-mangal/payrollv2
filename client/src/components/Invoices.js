import React, { useEffect, useMemo, useState } from "react";
import { apiPost, apiGet } from "../lib/api";

const toNum = (v) => (v === "" || v == null ? 0 : Number(v));

export default function Invoices({
  baseUrl,
  clients = [],
  selectedClientId,
  showToast = () => {},
  onAnyChange,
}) {
  const [form, setForm] = useState({
    clientId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    periodStart: "",
    periodEnd: "",
    billingType: "ONE_TIME", // ONE_TIME | MONTHLY
    gstMode: "EXCLUSIVE", // EXCLUSIVE | INCLUSIVE | NOGST
    gstRate: "",
    extraAmount: 0,
    remarks: "",
    lineItems: [{ description: "", amountExclGst: 0 }],
  });
  const [creating, setCreating] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [periodBills, setPeriodBills] = useState([]);

  const defaultGst = 0.18;

  useEffect(() => {
    setForm((f) => ({ ...f, clientId: selectedClientId || f.clientId }));
  }, [selectedClientId]);

  const addLine = () =>
    setForm((f) => ({
      ...f,
      lineItems: [
        ...f.lineItems,
        f.gstMode === "INCLUSIVE"
          ? { description: "", amountInclGst: 0 }
          : { description: "", amountExclGst: 0 },
      ],
    }));

  const updateLine = (i, patch) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((li, idx) =>
        idx === i ? { ...li, ...patch } : li
      ),
    }));

  const removeLine = (i) =>
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.filter((_, idx) => idx !== i),
    }));

  // ---- Calculate period days ----
  const periodDays = useMemo(() => {
    if (!form.periodStart || !form.periodEnd || form.billingType !== "ONE_TIME") {
      return 0;
    }
    const start = new Date(form.periodStart);
    const end = new Date(form.periodEnd);
    if (isNaN(start) || isNaN(end) || end < start) {
      return 0;
    }
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include end date
    return diffDays > 0 ? diffDays : 0;
  }, [form.periodStart, form.periodEnd, form.billingType]);

  // ---- Calculate period bills ----
  useEffect(() => {
    if (form.billingType !== "ONE_TIME" || periodDays <= 0) {
      setPeriodBills([]);
      return;
    }

    const bills = form.lineItems.map((li) => {
      const amount =
        form.gstMode === "INCLUSIVE"
          ? toNum(li.amountInclGst)
          : toNum(li.amountExclGst);

      const startDate = new Date(form.periodStart);
      if (isNaN(startDate)) return 0;

      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const prorated = (amount / daysInMonth) * periodDays;
      return Math.round((prorated + Number.EPSILON) * 100) / 100;
    });

    setPeriodBills(bills);
  }, [form, periodDays]);

  // ---- Totals (no qty) ----
  const totals = useMemo(() => {
    const gstMode = form.gstMode;
    const gstRate = gstMode === "NOGST" ? 0 : toNum(form.gstRate || defaultGst);
    const extra = toNum(form.extraAmount);

    const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

    let subtotalExclGst = 0;
    let gstAmount = 0;
    let totalInclGst = 0;

    if (form.billingType === "ONE_TIME" && periodDays > 0) {
      // Use prorated amounts from periodBills for ONE_TIME billing
      if (gstMode === "INCLUSIVE") {
        const sumInclusive = periodBills.reduce((s, amount) => s + toNum(amount), 0);
        const gross = round2(sumInclusive + extra);
        const divisor = 1 + gstRate;
        const base = gstRate > 0 ? round2(gross / divisor) : gross;
        subtotalExclGst = base;
        gstAmount = round2(gross - base);
        totalInclGst = gross;
      } else {
        // EXCLUSIVE or NOGST
        subtotalExclGst = round2(periodBills.reduce((s, amount) => s + toNum(amount), 0) + extra);
        gstAmount = gstMode === "NOGST" ? 0 : round2(subtotalExclGst * gstRate);
        totalInclGst = round2(subtotalExclGst + gstAmount);
      }
    } else {
      // MONTHLY billing or invalid periodDays
      const sumExclusive = form.lineItems.reduce((s, it) => {
        if (gstMode === "INCLUSIVE") return s;
        return s + toNum(it.amountExclGst);
      }, 0);

      const sumInclusive = form.lineItems.reduce((s, it) => {
        if (gstMode !== "INCLUSIVE") return s;
        return s + toNum(it.amountInclGst);
      }, 0);

      if (gstMode === "EXCLUSIVE") {
        subtotalExclGst = round2(sumExclusive + extra);
        gstAmount = round2(subtotalExclGst * gstRate);
        totalInclGst = round2(subtotalExclGst + gstAmount);
      } else if (gstMode === "INCLUSIVE") {
        const gross = round2(sumInclusive + extra);
        const divisor = 1 + gstRate;
        const base = gstRate > 0 ? round2(gross / divisor) : gross;
        subtotalExclGst = base;
        gstAmount = round2(gross - base);
        totalInclGst = gross;
      } else {
        // NOGST
        subtotalExclGst = round2(sumExclusive + extra);
        gstAmount = 0;
        totalInclGst = subtotalExclGst;
      }
    }

    return { gstRate, subtotalExclGst, gstAmount, totalInclGst };
  }, [form, defaultGst, periodBills, periodDays]);

  const validate = () => {
    if (!form.clientId && !selectedClientId) {
      showToast({ type: "error", text: "Please select a client." });
      return false;
    }
    if (!form.lineItems.length) {
      showToast({ type: "error", text: "Add at least one line item." });
      return false;
    }
    for (const [i, li] of form.lineItems.entries()) {
      if (!li.description?.trim()) {
        showToast({
          type: "error",
          text: `Line ${i + 1}: description required.`,
        });
        return false;
      }
      const val =
        form.gstMode === "INCLUSIVE"
          ? toNum(li.amountInclGst)
          : toNum(li.amountExclGst);
      if (!(val >= 0)) {
        showToast({ type: "error", text: `Line ${i + 1}: amount is invalid.` });
        return false;
      }
    }
    return true;
  };

  async function createInvoice() {
    try {
      if (!validate()) return;
      setCreating(true);
      const payload = {
        clientId: form.clientId || selectedClientId,
        issueDate: form.issueDate || undefined,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        billingType: form.billingType,
        gstMode: form.gstMode,
        extraAmount: toNum(form.extraAmount || 0),
        remarks: form.remarks || undefined,
        lineItems: form.lineItems.map((li, idx) => ({
          description: li.description,
          amountExclGst:
            form.gstMode !== "INCLUSIVE" && form.billingType === "ONE_TIME" && periodDays > 0
              ? toNum(periodBills[idx] || 0)
              : form.gstMode !== "INCLUSIVE"
              ? toNum(li.amountExclGst || 0)
              : undefined,
          amountInclGst:
            form.gstMode === "INCLUSIVE" && form.billingType === "ONE_TIME" && periodDays > 0
              ? toNum(periodBills[idx] || 0)
              : form.gstMode === "INCLUSIVE"
              ? toNum(li.amountInclGst || 0)
              : undefined,
        })),
      };
      if (form.gstMode !== "NOGST" && form.gstRate !== "") {
        payload.gstRate = toNum(form.gstRate);
      }

      const data = await apiPost(baseUrl, "/invoices", payload);
      setLastInvoice(data.invoice);
      showToast({
        type: "success",
        text: `Invoice ${data.invoice.invoiceNo} created`,
      });
      onAnyChange && onAnyChange();
    } catch (e) {
      showToast({
        type: "error",
        text: e.message || "Failed to create invoice",
      });
    } finally {
      setCreating(false);
    }
  }

  async function openInvoicePdf(inv) {
    console.log(inv);
    
    try {
      const data = await apiGet(baseUrl, `/invoices/${inv._id}/pdf`);
      if (!data?.url) throw new Error("PDF URL not available");
      window.open(data.url, "_blank");
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to open PDF" });
    }
  }

  async function shareWhatsApp(inv) {
    try {
      const r = await fetch(`${baseUrl}/share/whatsapp/invoice/${inv._id}`);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Share link error");
      window.open(data.shareUrl, "_blank");
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to share" });
    }
  }

  const rateLabel =
    form.gstMode === "INCLUSIVE"
      ? "Amount (incl. GST)"
      : form.gstMode === "EXCLUSIVE"
      ? "Amount (excl. GST)"
      : "Amount";

  return (
    <>
      {/* Header inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Client</label>
          <select
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            value={form.clientId || selectedClientId || ""}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Issue Date</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            type="date"
            value={form.issueDate}
            onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Period Start</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            type="date"
            value={form.periodStart}
            onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
            placeholder="Period Start"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Period End</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            type="date"
            value={form.periodEnd}
            onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
            placeholder="Period End"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Billing Type</label>
          <select
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
            value={form.billingType}
            onChange={(e) => setForm({ ...form, billingType: e.target.value })}
          >
            <option value="ONE_TIME">One Time</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">GST Mode</label>
          <select
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            value={form.gstMode}
            onChange={(e) => {
              const m = e.target.value;
              setForm((f) => ({
                ...f,
                gstMode: m,
                lineItems: f.lineItems.map((li) =>
                  m === "INCLUSIVE"
                    ? {
                        description: li.description,
                        amountInclGst: li.amountInclGst ?? li.amountExclGst ?? 0,
                      }
                    : {
                        description: li.description,
                        amountExclGst: li.amountExclGst ?? li.amountInclGst ?? 0,
                      }
                ),
              }));
            }}
          >
            <option value="EXCLUSIVE">EXCLUSIVE (GST extra)</option>
            <option value="INCLUSIVE">INCLUSIVE (GST included)</option>
            <option value="NOGST">NO GST</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            GST Rate {form.gstMode === "NOGST" ? "(ignored)" : "(e.g. 0.18)"}
          </label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            type="number"
            step="0.001"
            placeholder={`${defaultGst}`}
            disabled={form.gstMode === "NOGST"}
            value={form.gstRate}
            onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Extra Amount</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            type="number"
            step="0.01"
            placeholder="Extra Amount"
            value={form.extraAmount}
            onChange={(e) => setForm({ ...form, extraAmount: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs font-medium text-slate-600">Remarks</label>
          <input
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            placeholder="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Line Items</div>
          <button
            onClick={addLine}
            className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
          >
            Add Item
          </button>
        </div>

        <div className="space-y-2">
          {form.lineItems.map((li, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-10 gap-2 items-center bg-slate-50 rounded-xl p-3 border"
            >
              <input
                className="px-3 py-2 rounded-lg border text-sm md:col-span-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Description (e.g., Monthly Digital Marketing Retainer)"
                value={li.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
              />

              {form.gstMode === "INCLUSIVE" ? (
                <input
                  className="px-3 py-2 rounded-lg border text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  step="0.01"
                  placeholder={rateLabel}
                  value={li.amountInclGst ?? 0}
                  onChange={(e) => updateLine(idx, { amountInclGst: e.target.value })}
                />
              ) : (
                <input
                  className="px-3 py-2 rounded-lg border text-sm md:col-span-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="number"
                  step="0.01"
                  placeholder={rateLabel}
                  value={li.amountExclGst ?? 0}
                  onChange={(e) => updateLine(idx, { amountExclGst: e.target.value })}
                />
              )}

              <div className="md:col-span-1 flex justify-center flex-col ml-8">
                {form.billingType === "ONE_TIME" && periodDays > 0 ? (
                  <>
                    <span className="text-sm text-slate-600">{periodDays} days</span>
                    <span className="text-sm text-slate-600">
                      ₹ {(periodBills[idx] ?? 0).toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">N/A</span>
                )}
              </div>

              <div className="md:col-span-1 flex justify-end">
                <button
                  onClick={() => removeLine(idx)}
                  className="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="text-sm text-slate-600">
            <div>
              <span className="font-medium">Billing Type:</span>{" "}
              {form.billingType === "MONTHLY" ? "Monthly" : "One Time"}
            </div>
            <div>
              <span className="font-medium">GST Mode:</span> {form.gstMode}
            </div>
            <div>
              <span className="font-medium">GST Rate:</span>{" "}
              {form.gstMode === "NOGST"
                ? "N/A"
                : `${(totals.gstRate * 100).toFixed(2)} %`}
            </div>
            {form.billingType === "ONE_TIME" && periodDays > 0 && (
              <div>
                <span className="font-medium">Period Duration:</span> {periodDays} days
              </div>
            )}
          </div>

          <div className="text-sm bg-slate-50 border rounded-xl p-3">
            <div className="flex justify-between">
              {form.billingType === "ONE_TIME" && periodDays > 0 ? (
                <>
                  <span>Prorated Taxable Value (One Time)</span>
                  <span>₹ {totals.subtotalExclGst.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span>Monthly Taxable Value</span>
                  <span>₹ {totals.subtotalExclGst.toFixed(2)}</span>
                </>
              )}
            </div>

            <div className="flex justify-between">
              <span>GST Amount</span>
              <span>₹ {totals.gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total (Gross)</span>
              <span>₹ {totals.totalInclGst.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={createInvoice}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
          {lastInvoice && (
            <>
              <button
                className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
                onClick={() => openInvoicePdf(lastInvoice)}
              >
                Open PDF
              </button>
              <button
                className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
                onClick={() => shareWhatsApp(lastInvoice)}
              >
                Share on WhatsApp
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}