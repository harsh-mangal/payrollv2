import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

// Extend once at module scope
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export default function ClientDetailPage({ baseUrl, showToast }) {
  const { id } = useParams();

  // client & tabs data
  const [client, setClient] = useState(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetings, setMeetings] = useState([]);

  // Month-wise invoice controls
  const [invMonth, setInvMonth] = useState(String(new Date().getMonth() + 1)); // "1".."12"
  const [invYear, setInvYear] = useState(String(new Date().getFullYear()));
  const [invGstMode, setInvGstMode] = useState("EXCLUSIVE");
  const [invCreating, setInvCreating] = useState(false);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const invMonthNum = Number(invMonth);
  const invYearNum = Number(invYear);
  const monthYearValid =
    Number.isInteger(invMonthNum) &&
    invMonthNum >= 1 &&
    invMonthNum <= 12 &&
    Number.isInteger(invYearNum) &&
    invYearNum >= 2000 &&
    invYearNum <= 2100;

  // services
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcForm, setSvcForm] = useState({
    kind: "HOSTING",
    billingType: "MONTHLY",
    amountMonthly: 0,
    amountOneTime: 0,
    startDate: "",
    expiryDate: "",
    notes: "",
  });

  // credentials form
  const [credForm, setCredForm] = useState({
    panelName: "",
    projectName: "",
    environment: "PROD",
    url: "",
    username: "",
    password: "",
    tags: "",
    notes: "",
  });

  // meeting form
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "",
    title: "",
    attendees: "",
    remarks: "",
    summary: "",
    nextFollowUp: "",
  });

  const canSubmitService = useMemo(() => {
    if (!svcForm.startDate) return false;
    if (svcForm.billingType === "MONTHLY" && Number(svcForm.amountMonthly) <= 0)
      return false;
    if (
      svcForm.billingType === "ONE_TIME" &&
      Number(svcForm.amountOneTime) <= 0
    )
      return false;
    return true;
  }, [svcForm]);

  async function loadClient() {
    if (!baseUrl || !id) return;
    try {
      const res = await apiGet(baseUrl, `/clients/${id}`);
      setClient(res.client);
    } catch (e) {
      showToast({ type: "error", text: "Failed to load client" });
    }
  }

  async function loadCredentials() {
    if (!baseUrl || !id) return;
    try {
      setCredLoading(true);
      const res = await apiGet(baseUrl, `/clients/${id}/credentials`);
      setCredentials(res.credentials || []);
    } catch {
      showToast({ type: "error", text: "Failed to load credentials" });
    } finally {
      setCredLoading(false);
    }
  }

  async function loadMeetings() {
    if (!baseUrl || !id) return;
    try {
      setMeetLoading(true);
      const res = await apiGet(baseUrl, `/clients/${id}/meetings`);
      setMeetings(res.meetings || []);
    } catch {
      showToast({ type: "error", text: "Failed to load meetings" });
    } finally {
      setMeetLoading(false);
    }
  }

  useEffect(() => {
    loadClient();
    loadCredentials();
    loadMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, id]);

  async function addService() {
    if (!id) return;
    if (!canSubmitService) {
      showToast({ type: "error", text: "Please fill required service fields" });
      return;
    }
    try {
      setSvcSaving(true);
      const payload = {
        ...svcForm,
        amountMonthly: Number(svcForm.amountMonthly || 0),
        amountOneTime: Number(svcForm.amountOneTime || 0),
        startDate: svcForm.startDate ? new Date(svcForm.startDate) : new Date(),
        expiryDate: svcForm.expiryDate
          ? new Date(svcForm.expiryDate)
          : undefined,
      };
      const res = await apiPost(baseUrl, `/clients/${id}/services`, payload);
      setClient(res.client);
      showToast({ type: "success", text: "Service added" });
      setSvcForm({
        kind: "HOSTING",
        billingType: "MONTHLY",
        amountMonthly: 0,
        amountOneTime: 0,
        startDate: "",
        expiryDate: "",
        notes: "",
      });
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to add service" });
    } finally {
      setSvcSaving(false);
    }
  }

  async function addCredential() {
    try {
      if (!credForm.panelName || !credForm.username || !credForm.password) {
        showToast({
          type: "error",
          text: "Panel, Username and Password are required",
        });
        return;
      }
      const payload = {
        ...credForm,
        tags: credForm.tags
          ? credForm.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };
      const res = await apiPost(baseUrl, `/clients/${id}/credentials`, payload);
      setCredentials(res.client?.credentials || []);
      setCredForm({
        panelName: "",
        projectName: "",
        environment: "PROD",
        url: "",
        username: "",
        password: "",
        tags: "",
        notes: "",
      });
      showToast({ type: "success", text: "Credential added" });
    } catch (e) {
      showToast({
        type: "error",
        text: e.message || "Failed to add credential",
      });
    }
  }

  async function addMeeting() {
    try {
      const payload = {
        ...meetingForm,
        meetingDate: meetingForm.meetingDate
          ? new Date(meetingForm.meetingDate)
          : new Date(),
        nextFollowUp: meetingForm.nextFollowUp
          ? new Date(meetingForm.nextFollowUp)
          : undefined,
        attendees: meetingForm.attendees
          ? meetingForm.attendees
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };
      const res = await apiPost(baseUrl, `/clients/${id}/meetings`, payload);
      setMeetings(res.client?.meetings || []);
      setMeetingForm({
        meetingDate: "",
        title: "",
        attendees: "",
        remarks: "",
        summary: "",
        nextFollowUp: "",
      });
      showToast({ type: "success", text: "Meeting saved" });
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to add meeting" });
    }
  }

  async function createMonthInvoiceFromServices() {
    try {
      if (!monthYearValid) {
        showToast({
          type: "error",
          text: "Please select a valid month & year",
        });
        return;
      }
      setInvCreating(true);
      const body = {
        clientId: id,
        month: invMonthNum,
        year: invYearNum,
        gstMode: invGstMode, // "EXCLUSIVE" | "INCLUSIVE" | "NOGST"
      };
      const res = await apiPost(baseUrl, `/invoices/from-services`, body);
      showToast({
        type: "success",
        text: `Invoice ${res.invoice.invoiceNo} created`,
      });
      if (res.pdfUrl) window.open(res.pdfUrl, "_blank");
    } catch (e) {
      showToast({
        type: "error",
        text: e.message || "Failed to create month invoice",
      });
    } finally {
      setInvCreating(false);
    }
  }

  if (!client) {
    return (
      <div className="text-slate-600">
        <Link className="text-indigo-600 hover:underline" to="/clients">
          ← Back
        </Link>
        <div className="mt-4">Loading client…</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link className="text-indigo-600 hover:underline" to="/clients">
          ← Back to Clients
        </Link>
      </div>

      <h2 className="text-xl font-semibold">{client.name}</h2>
      <div className="text-slate-600 text-sm">
        {client.email || "-"} • {client.phone || "-"} • GSTIN:{" "}
        {client.gstin || "-"}
      </div>

      {/* Month-wise invoice (services) */}
      <section className="border rounded-xl p-4 mt-6">
        <h3 className="font-semibold mb-3">Month-wise Invoice (Services)</h3>
        <div className="grid grid-cols-2 gap-3">
          <select
            className="input"
            value={invMonth}
            onChange={(e) => setInvMonth(e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)}>
                {monthNames[m - 1]}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min={2000}
            max={2100}
            value={invYear}
            onChange={(e) => setInvYear(e.target.value)}
          />
          <select
            className="input col-span-2"
            value={invGstMode}
            onChange={(e) => setInvGstMode(e.target.value)}
          >
            <option value="EXCLUSIVE">GST Exclusive</option>
            <option value="INCLUSIVE">GST Inclusive</option>
            <option value="NOGST">No GST</option>
          </select>
          <button
            className="btn-primary col-span-2"
            onClick={createMonthInvoiceFromServices}
            disabled={invCreating || !monthYearValid}
          >
            {invCreating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </section>

      {/* Body grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services */}
        <section className="border rounded-xl p-4 lg:col-span-1">
          <h3 className="font-semibold mb-3">Create Service</h3>
          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm text-slate-600">Kind</label>
            <select
              className="input"
              value={svcForm.kind}
              onChange={(e) => setSvcForm({ ...svcForm, kind: e.target.value })}
            >
              <option value="HOSTING">HOSTING</option>
              <option value="DIGITAL_MARKETING">DIGITAL_MARKETING</option>
              <option value="OTHER">OTHER</option>
            </select>

            <label className="text-sm text-slate-600">Billing Type</label>
            <select
              className="input"
              value={svcForm.billingType}
              onChange={(e) =>
                setSvcForm({ ...svcForm, billingType: e.target.value })
              }
            >
              <option value="MONTHLY">MONTHLY</option>
              <option value="ONE_TIME">ONE_TIME</option>
            </select>

            {svcForm.billingType === "MONTHLY" ? (
              <input
                className="input"
                type="number"
                placeholder="Monthly Amount (GST excl.)"
                value={svcForm.amountMonthly}
                onChange={(e) =>
                  setSvcForm({
                    ...svcForm,
                    amountMonthly: Number(e.target.value),
                  })
                }
              />
            ) : (
              <input
                className="input"
                type="number"
                placeholder="One-time Amount (GST excl.)"
                value={svcForm.amountOneTime}
                onChange={(e) =>
                  setSvcForm({
                    ...svcForm,
                    amountOneTime: Number(e.target.value),
                  })
                }
              />
            )}

            <label className="text-sm text-slate-600">Start Date *</label>
            <input
              className="input"
              type="date"
              value={svcForm.startDate}
              onChange={(e) =>
                setSvcForm({ ...svcForm, startDate: e.target.value })
              }
            />

            <label className="text-sm text-slate-600">
              Expiry Date (optional)
            </label>
            <input
              className="input"
              type="date"
              value={svcForm.expiryDate}
              onChange={(e) =>
                setSvcForm({ ...svcForm, expiryDate: e.target.value })
              }
            />

            <textarea
              className="input min-h-[80px]"
              placeholder="Notes"
              value={svcForm.notes}
              onChange={(e) =>
                setSvcForm({ ...svcForm, notes: e.target.value })
              }
            />

            <button
              className="btn-primary"
              disabled={!canSubmitService || svcSaving}
              onClick={addService}
            >
              {svcSaving ? "Saving…" : "Add Service"}
            </button>
          </div>

          <h4 className="font-semibold mt-6 mb-2">Existing Services</h4>
          <div className="max-h-56 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Billing</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Start</th>
                </tr>
              </thead>
              <tbody>
                {(client.services || [])
                  .slice()
                  .reverse()
                  .map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="td">{s.kind}</td>
                      <td className="td">{s.billingType}</td>
                      <td className="td">
                        {s.billingType === "MONTHLY"
                          ? s.amountMonthly
                          : s.amountOneTime}
                      </td>
                      <td className="td">
                        {s.startDate
                          ? new Date(s.startDate).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                {(client.services || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No services yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Credentials */}
        <section className="border rounded-xl p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Credentials</h3>
            {credLoading && (
              <span className="text-xs text-slate-500">Loading…</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Panel Name *"
              value={credForm.panelName}
              onChange={(e) =>
                setCredForm({ ...credForm, panelName: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Project"
              value={credForm.projectName}
              onChange={(e) =>
                setCredForm({ ...credForm, projectName: e.target.value })
              }
            />
            <select
              className="input"
              value={credForm.environment}
              onChange={(e) =>
                setCredForm({ ...credForm, environment: e.target.value })
              }
            >
              <option value="PROD">PROD</option>
              <option value="STAGING">STAGING</option>
              <option value="DEV">DEV</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input
              className="input"
              placeholder="URL"
              value={credForm.url}
              onChange={(e) =>
                setCredForm({ ...credForm, url: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Username *"
              value={credForm.username}
              onChange={(e) =>
                setCredForm({ ...credForm, username: e.target.value })
              }
            />
            <input
              className="input"
              type="password"
              placeholder="Password *"
              value={credForm.password}
              onChange={(e) =>
                setCredForm({ ...credForm, password: e.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Tags (comma separated)"
              value={credForm.tags}
              onChange={(e) =>
                setCredForm({ ...credForm, tags: e.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Notes"
              value={credForm.notes}
              onChange={(e) =>
                setCredForm({ ...credForm, notes: e.target.value })
              }
            />
            <div className="md:col-span-2">
              <button
                onClick={async () => {
                  await addCredential();
                  await loadClient();
                }}
                className="btn-primary"
              >
                + Add Credential
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-56 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Panel</th>
                  <th className="px-3 py-2 text-left">Env</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">URL</th>
                  <th className="px-3 py-2 text-left">Tags</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cr) => (
                  <tr key={cr._id} className="hover:bg-slate-50">
                    <td className="td font-medium">{cr.panelName}</td>
                    <td className="td">{cr.environment}</td>
                    <td className="td">{cr.username}</td>
                    <td className="td">
                      {cr.url ? (
                        <a
                          className="text-indigo-600 underline"
                          target="_blank"
                          rel="noreferrer"
                          href={cr.url}
                        >
                          open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="td">{(cr.tags || []).join(", ") || "-"}</td>
                  </tr>
                ))}
                {credentials.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No credentials
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meetings */}
        <section className="border rounded-xl p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Meetings</h3>
            {meetLoading && (
              <span className="text-xs text-slate-500">Loading…</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              type="datetime-local"
              value={meetingForm.meetingDate}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, meetingDate: e.target.value })
              }
            />
            <input
              className="input"
              placeholder="Title"
              value={meetingForm.title}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, title: e.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Attendees (comma separated)"
              value={meetingForm.attendees}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, attendees: e.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Remarks"
              value={meetingForm.remarks}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, remarks: e.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Summary"
              value={meetingForm.summary}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, summary: e.target.value })
              }
            />
            <input
              className="input"
              type="date"
              value={meetingForm.nextFollowUp}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, nextFollowUp: e.target.value })
              }
            />
            <div className="md:col-span-2">
              <button onClick={addMeeting} className="btn-primary">
                + Save Meeting
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-72 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Attendees</th>
                  <th className="px-3 py-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50 align-top">
                    <td className="td">
                      {m.meetingDate
                        ? new Date(m.meetingDate).toLocaleString()
                        : "-"}
                      {m.nextFollowUp && (
                        <div className="text-xs text-amber-700">
                          Next: {new Date(m.nextFollowUp).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="td">
                      <div className="font-medium">{m.title || "-"}</div>
                      {m.summary && (
                        <div className="text-xs text-slate-500">
                          {m.summary}
                        </div>
                      )}
                    </td>
                    <td className="td">
                      {(m.attendees || []).join(", ") || "-"}
                    </td>
                    <td className="td">{m.remarks || "-"}</td>
                  </tr>
                ))}
                {meetings.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-slate-500"
                    >
                      No meetings yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
        .input { @apply px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full; }
        .btn-primary { @apply px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700; }
        .td { @apply px-3 py-2 border-t; }
      `}</style>
    </>
  );
}
