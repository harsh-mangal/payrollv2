// src/pages/QuotationsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

function LineItemRow({ idx, item, gstMode, onChange, onRemove }) {
  const priceLabel =
    gstMode === "INCLUSIVE"
      ? "Unit Price (incl. GST)"
      : gstMode === "NOGST"
      ? "Unit Price (no GST)"
      : "Unit Price (excl. GST)";

  return (
    <tr className="align-top">
      <td className="td">
        <input
          className="input"
          placeholder="Description"
          value={item.description}
          onChange={(e) =>
            onChange(idx, { ...item, description: e.target.value })
          }
        />
      </td>
      <td className="td">
        <input
          type="number"
          min="1"
          className="input w-24"
          placeholder="Qty"
          value={item.qty}
          onChange={(e) =>
            onChange(idx, { ...item, qty: Number(e.target.value || 1) })
          }
        />
      </td>
      <td className="td">
        {gstMode === "INCLUSIVE" ? (
          <input
            type="number"
            className="input w-40"
            placeholder={priceLabel}
            value={item.unitPriceInclGst}
            onChange={(e) =>
              onChange(idx, {
                ...item,
                unitPriceInclGst: Number(e.target.value || 0),
              })
            }
          />
        ) : (
          <input
            type="number"
            className="input w-40"
            placeholder={priceLabel}
            value={item.unitPriceExclGst}
            onChange={(e) =>
              onChange(idx, {
                ...item,
                unitPriceExclGst: Number(e.target.value || 0),
              })
            }
          />
        )}
      </td>
      <td className="td text-right">
        <button
          className="text-red-600 text-xs hover:underline"
          onClick={() => onRemove(idx)}
        >
          remove
        </button>
      </td>
    </tr>
  );
}

export default function QuotationsPage({ baseUrl, clients, showToast }) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);

  // Create form state
  const [clientId, setClientId] = useState("");
  const [recipient, setRecipient] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
  });
  const [issueDate, setIssueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [gstMode, setGstMode] = useState("EXCLUSIVE");
  const [gstRate, setGstRate] = useState(
    Number(import.meta?.env?.VITE_GST_RATE ?? 0.18)
  );
  const [extraAmount, setExtraAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState([
    { description: "", qty: 1, unitPriceExclGst: 0, unitPriceInclGst: 0 },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    refresh();
  }, [baseUrl]);

  async function refresh() {
    try {
      setLoading(true);
      const res = await apiGet(baseUrl, "/quotations");
      setList(res.list || []);
    } catch (e) {
      showToast({
        type: "error",
        text: e.message || "Failed to load quotations",
      });
    } finally {
      setLoading(false);
    }
  }

  // Auto-fill recipient from selected client (no custom hook name, no hook inside callback)
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x._id === clientId);
    if (!c) return;
    setRecipient({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      company: c.name || "",
      address: c.address || "",
    });
  }, [clientId, clients]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", qty: 1, unitPriceExclGst: 0, unitPriceInclGst: 0 },
    ]);
  }
  function changeItem(idx, next) {
    setItems((prev) => prev.map((it, i) => (i === idx ? next : it)));
  }
  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const computedTotals = useMemo(() => {
    const toNum = (v) => Number(v || 0);
    const sum = items.reduce((acc, it) => {
      const qty = toNum(it.qty || 1);
      if (gstMode === "INCLUSIVE")
        return acc + toNum(it.unitPriceInclGst) * qty;
      return acc + toNum(it.unitPriceExclGst) * qty;
    }, 0);
    const extra = toNum(extraAmount);

    if (gstMode === "INCLUSIVE") {
      const gross = Math.round((sum + extra) * 100) / 100;
      const base =
        gstRate > 0 ? Math.round((gross / (1 + gstRate)) * 100) / 100 : gross;
      const gst = Math.round((gross - base) * 100) / 100;
      return { subtotalExclGst: base, gstAmount: gst, totalInclGst: gross };
    } else if (gstMode === "EXCLUSIVE") {
      const base = Math.round((sum + extra) * 100) / 100;
      const gst = Math.round(base * gstRate * 100) / 100;
      const tot = Math.round((base + gst) * 100) / 100;
      return { subtotalExclGst: base, gstAmount: gst, totalInclGst: tot };
    } else {
      const base = Math.round((sum + extra) * 100) / 100;
      return { subtotalExclGst: base, gstAmount: 0, totalInclGst: base };
    }
  }, [items, extraAmount, gstMode, gstRate]);

  async function createQuotation() {
    try {
      if (!items.length || !items[0].description) {
        showToast({ type: "error", text: "Add at least one line item" });
        return;
      }
      setCreating(true);
      const body = {
        clientId: clientId || undefined,
        recipient,
        issueDate: issueDate || undefined,
        validUntil: validUntil || undefined,
        gstMode,
        gstRate,
        lineItems: items,
        extraAmount: Number(extraAmount || 0),
        terms,
        notes,
      };
      const res = await apiPost(baseUrl, "/quotations", body);
      showToast({
        type: "success",
        text: `Quotation ${res.quotation.quoteNo} created`,
      });
      if (res.pdfUrl) window.open(res.pdfUrl, "_blank");
      setItems([
        { description: "", qty: 1, unitPriceExclGst: 0, unitPriceInclGst: 0 },
      ]);
      setNotes("");
      setTerms("");
      setExtraAmount(0);
      refresh();
    } catch (e) {
      showToast({
        type: "error",
        text: e.message || "Failed to create quotation",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Create Quotation</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recipient & Meta */}
        <section className="border rounded-xl p-4">
          <div className="text-sm text-slate-600 mb-2">Recipient</div>
          <select
            className="input mb-2"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— Select Client (optional) —</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="input mb-2"
            placeholder="Name"
            value={recipient.name}
            onChange={(e) =>
              setRecipient({ ...recipient, name: e.target.value })
            }
          />
          <input
            className="input mb-2"
            placeholder="Email"
            value={recipient.email}
            onChange={(e) =>
              setRecipient({ ...recipient, email: e.target.value })
            }
          />
          <input
            className="input mb-2"
            placeholder="Phone"
            value={recipient.phone}
            onChange={(e) =>
              setRecipient({ ...recipient, phone: e.target.value })
            }
          />
          <input
            className="input mb-2"
            placeholder="Company"
            value={recipient.company}
            onChange={(e) =>
              setRecipient({ ...recipient, company: e.target.value })
            }
          />
          <textarea
            className="input"
            placeholder="Address"
            value={recipient.address}
            onChange={(e) =>
              setRecipient({ ...recipient, address: e.target.value })
            }
          />

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <div className="text-sm text-slate-600 mb-1">Issue Date</div>
              <input
                type="date"
                className="input"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <div className="text-sm text-slate-600 mb-1">Valid Until</div>
              <input
                type="date"
                className="input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Middle: Items */}
        <section className="border rounded-xl p-4 lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <select
              className="input"
              value={gstMode}
              onChange={(e) => setGstMode(e.target.value)}
            >
              <option value="EXCLUSIVE">GST Exclusive</option>
              <option value="INCLUSIVE">GST Inclusive</option>
              <option value="NOGST">No GST</option>
            </select>
            <input
              type="number"
              step="0.01"
              className="input"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value || 0))}
            />
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="Extra Amount"
              value={extraAmount}
              onChange={(e) => setExtraAmount(Number(e.target.value || 0))}
            />
            <button className="btn-secondary" onClick={addItem}>
              + Add Item
            </button>
          </div>

          <div className="max-h-72 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Unit Price</th>
                  <th className="px-3 py-2 text-right w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <LineItemRow
                    key={i}
                    idx={i}
                    item={it}
                    gstMode={gstMode}
                    onChange={changeItem}
                    onRemove={removeItem}
                  />
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <textarea
              className="input"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <textarea
              className="input"
              placeholder="Terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Subtotal (excl):{" "}
              <b>{computedTotals.subtotalExclGst.toFixed(2)}</b>
              <br />
              GST: <b>{computedTotals.gstAmount.toFixed(2)}</b>
              <br />
              Total (incl): <b>{computedTotals.totalInclGst.toFixed(2)}</b>
            </div>
            <button
              className="btn-primary"
              onClick={createQuotation}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create Quotation"}
            </button>
          </div>
        </section>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-3">
        Quotations{" "}
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </h2>
      <div className="max-h-80 overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="th">Quote #</th>
              <th className="th">Recipient</th>
              <th className="th">Issued</th>
              <th className="th">Valid Until</th>
              <th className="th">Total</th>
              <th className="th">Status</th>
              <th className="th">PDF</th>
            </tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q._id} className="hover:bg-slate-50">
                <td className="td font-medium">{q.quoteNo}</td>
                <td className="td">{q.recipient?.name || "-"}</td>
                <td className="td">
                  {q.issueDate
                    ? new Date(q.issueDate).toLocaleDateString()
                    : "-"}
                </td>
                <td className="td">
                  {q.validUntil
                    ? new Date(q.validUntil).toLocaleDateString()
                    : "-"}
                </td>
                <td className="td">{q.totalInclGst?.toFixed?.(2) ?? "-"}</td>
                <td className="td">{q.status}</td>
                <td className="td">
                  <a
                    className="text-indigo-600 underline"
                    href={`${baseUrl}/quotations/${q._id}/pdf`}
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const r = await apiGet(
                          baseUrl,
                          `/quotations/${q._id}/pdf`
                        );
                        window.open(r.url, "_blank");
                      } catch (err) {
                        showToast({ type: "error", text: "PDF not ready" });
                      }
                    }}
                  >
                    open
                  </a>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No quotations yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .input { @apply px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full; }
        .btn-primary { @apply px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700; }
        .btn-secondary { @apply px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200; }
        .th { @apply text-left px-3 py-2 font-medium text-slate-600; }
        .td { @apply px-3 py-2 border-t; }
      `}</style>
    </>
  );
}
