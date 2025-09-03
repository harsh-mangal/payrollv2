import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import Select from "react-select";

function LineItemRow({ idx, item, gstMode, onChange, onRemove }) {
  const priceLabel =
    gstMode === "INCLUSIVE"
      ? "Unit Price (incl. GST)"
      : gstMode === "NOGST"
        ? "Unit Price (no GST)"
        : "Unit Price (excl. GST)";

  const BillingType = [
    { value: "ONE_TIME", label: "One Time" },
    { value: "MONTHLY", label: "Monthly" },
  ];

  return (
    <tr className="align-top hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 border-t">
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="Enter description"
          value={item.description}
          onChange={(e) =>
            onChange(idx, { ...item, description: e.target.value })
          }
        />
      </td>
      <td className="px-4 py-3 border-t">
        <Select
          options={BillingType}
          value={BillingType.find((o) => o.value === item.frequency) || null}
          onChange={(selected) =>
            onChange(idx, { ...item, frequency: selected?.value })
          }
          isClearable
          placeholder="Billing Type"
          menuPortalTarget={document.body}
          styles={{
            container: (base) => ({ ...base, minWidth: "120px" }),
            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            control: (base) => ({
              ...base,
              borderColor: "#d1d5db",
              boxShadow: "none",
              "&:hover": { borderColor: "#6366f1" },
            }),
            option: (base, { isFocused }) => ({
              ...base,
              backgroundColor: isFocused ? "#f3f4f6" : "white",
              color: "#1f2937",
              "&:hover": { backgroundColor: "#e5e7eb" },
            }),
          }}
        />
      </td>
      <td className="px-4 py-3 border-t">
        <input
          type="number"
          step="0.01"
          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder={priceLabel}
          value={
            gstMode === "INCLUSIVE" ? item.unitPriceInclGst : item.unitPriceExclGst
          }
          onChange={(e) =>
            onChange(idx, {
              ...item,
              [gstMode === "INCLUSIVE" ? "unitPriceInclGst" : "unitPriceExclGst"]:
                Number(e.target.value || 0),
            })
          }
        />
      </td>
      <td className="px-4 py-3 border-t text-right">
        <button
          className="text-red-600 text-sm font-medium hover:text-red-800 transition"
          onClick={() => onRemove(idx)}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export default function QuotationsPage({ baseUrl, clients, showToast }) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
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
    { description: "", frequency: "ONE_TIME", unitPriceExclGst: 0, unitPriceInclGst: 0 },
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
      { description: "", frequency: "", unitPriceExclGst: 0, unitPriceInclGst: 0 },
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
      if (gstMode === "INCLUSIVE")
        return acc + toNum(it.unitPriceInclGst);
      return acc + toNum(it.unitPriceExclGst);
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
        { description: "", frequency: "ONE_TIME", unitPriceExclGst: 0, unitPriceInclGst: 0 },
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Quotation</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recipient & Meta */}
        <section className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Recipient Details</h3>
          <select
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 transition"
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
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 transition"
            placeholder="Full Name"
            value={recipient.name}
            onChange={(e) =>
              setRecipient({ ...recipient, name: e.target.value })
            }
          />
          <input
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 transition"
            placeholder="Email Address"
            value={recipient.email}
            onChange={(e) =>
              setRecipient({ ...recipient, email: e.target.value })
            }
          />
          <input
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 transition"
            placeholder="Phone Number"
            value={recipient.phone}
            onChange={(e) =>
              setRecipient({ ...recipient, phone: e.target.value })
            }
          />
          <input
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 transition"
            placeholder="Company Name"
            value={recipient.company}
            onChange={(e) =>
              setRecipient({ ...recipient, company: e.target.value })
            }
          />
          <textarea
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="Address"
            rows={4}
            value={recipient.address}
            onChange={(e) =>
              setRecipient({ ...recipient, address: e.target.value })
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">
                Issue Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 mb-1 block">
                Valid Until
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Middle: Items */}
        <section className="bg-white shadow-sm rounded-lg p-6 lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <select
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
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
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="GST Rate"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value || 0))}
            />
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Extra Amount"
              value={extraAmount}
              onChange={(e) => setExtraAmount(Number(e.target.value || 0))}
            />
            <button
              className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
              onClick={addItem}
            >
              + Add Item
            </button>
          </div>

          <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Price
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 w-20">
                    Action
                  </th>
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
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No items added
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <textarea
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Additional Notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <textarea
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Terms and Conditions"
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              <p>
                Subtotal (excl. GST):{" "}
                <span className="font-semibold">
                  ${computedTotals.subtotalExclGst.toFixed(2)}
                </span>
              </p>
              <p>
                GST Amount:{" "}
                <span className="font-semibold">
                  ${computedTotals.gstAmount.toFixed(2)}
                </span>
              </p>
              <p>
                Total (incl. GST):{" "}
                <span className="font-semibold">
                  ${computedTotals.totalInclGst.toFixed(2)}
                </span>
              </p>
            </div>
            <button
              className={`px-4 py-2 rounded-md text-white text-sm font-medium transition ${creating
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              onClick={createQuotation}
              disabled={creating}
            >
              {creating ? "Creating..." : "Create Quotation"}
            </button>
          </div>
        </section>
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-6">
        Quotations
        {loading && (
          <span className="ml-2 text-xs text-gray-500">Loading...</span>
        )}
      </h2>
      <div className="max-h-80 overflow-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Quote #
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Recipient
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Issued
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Valid Until
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Total
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">
                PDF
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 border-t font-medium">{q.quoteNo}</td>
                <td className="px-4 py-3 border-t">{q.recipient?.name || "-"}</td>
                <td className="px-4 py-3 border-t">
                  {q.issueDate
                    ? new Date(q.issueDate).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 border-t">
                  {q.validUntil
                    ? new Date(q.validUntil).toLocaleDateString()
                    : "-"}
                </td>
                <td className="px-4 py-3 border-t">
                  {q.totalInclGst?.toFixed?.(2) ?? "-"}
                </td>
                <td className="px-4 py-3 border-t">{q.status}</td>
                <td className="px-4 py-3 border-t">
                  <a
                    className="text-indigo-600 hover:text-indigo-800 underline transition"
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
                    Open
                  </a>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No quotations yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}