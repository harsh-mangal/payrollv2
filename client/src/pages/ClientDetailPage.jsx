import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import Select from "react-select";

// Extend dayjs plugins
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export default function ClientDetailPage({ baseUrl, showToast }) {
  const { id } = useParams();

  // State management
  const [client, setClient] = useState(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [invMonth, setInvMonth] = useState(String(new Date().getMonth() + 1));
  const [invYear, setInvYear] = useState(String(new Date().getFullYear()));
  const [invGstMode, setInvGstMode] = useState("EXCLUSIVE");
  const [invCreating, setInvCreating] = useState(false);
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
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "",
    title: "",
    attendees: "",
    remarks: "",
    summary: "",
    nextFollowUp: "",
  });

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

  const canSubmitService = useMemo(() => {
    if (!svcForm.startDate) return false;
    if (svcForm.billingType === "MONTHLY" && Number(svcForm.amountMonthly) <= 0)
      return false;
    if (svcForm.billingType === "ONE_TIME" && Number(svcForm.amountOneTime) <= 0)
      return false;
    return true;
  }, [svcForm]);

  // API calls
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
  }, [baseUrl, id]);

  async function addService() {
    if (!id || !canSubmitService) {
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
        expiryDate: svcForm.expiryDate ? new Date(svcForm.expiryDate) : undefined,
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
          text: "Panel, Username, and Password are required",
        });
        return;
      }
      const payload = {
        ...credForm,
        tags: credForm.tags
          ? credForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
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
        meetingDate: meetingForm.meetingDate ? new Date(meetingForm.meetingDate) : new Date(),
        nextFollowUp: meetingForm.nextFollowUp ? new Date(meetingForm.nextFollowUp) : undefined,
        attendees: meetingForm.attendees
          ? meetingForm.attendees.split(",").map((s) => s.trim()).filter(Boolean)
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
        gstMode: invGstMode,
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
      <div className="p-6 max-w-7xl mx-auto">
        <Link className="text-indigo-600 hover:underline text-sm font-medium" to="/clients">
          ← Back to Clients
        </Link>
        <div className="mt-4 text-slate-600">Loading client...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link className="text-indigo-600 hover:underline text-sm font-medium" to="/clients">
          ← Back to Clients
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mt-2">{client.name}</h2>
        <div className="text-sm text-gray-500 flex flex-wrap gap-2">
          <span>{client.email || "-"}</span>
          <span>•</span>
          <span>{client.phone || "-"}</span>
          <span>•</span>
          <span>GSTIN: {client.gstin || "-"}</span>
        </div>
      </div>

      {/* Month-wise Invoice */}
      <section className="bg-white shadow-sm rounded-lg p-6 mb-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Month-wise Invoice (Services)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <Select
              className="w-full"
              value={{ value: invMonth, label: monthNames[invMonthNum - 1] }}
              onChange={(opt) => setInvMonth(opt.value)}
              options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
              classNamePrefix="select"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              type="number"
              min={2000}
              max={2100}
              value={invYear}
              onChange={(e) => setInvYear(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Mode</label>
            <Select
              className="w-full"
              value={{ value: invGstMode, label: invGstMode.replace("_", " ") }}
              onChange={(opt) => setInvGstMode(opt.value)}
              options={[
                { value: "EXCLUSIVE", label: "GST Exclusive" },
                { value: "INCLUSIVE", label: "GST Inclusive" },
                { value: "NOGST", label: "No GST" },
              ]}
              classNamePrefix="select"
            />
          </div>
          <button
            className={`w-full sm:col-span-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
              invCreating || !monthYearValid
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
            onClick={createMonthInvoiceFromServices}
            disabled={invCreating || !monthYearValid}
          >
            {invCreating ? "Creating..." : "Create Invoice"}
          </button>
        </div>
      </section>

      {/* Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services */}
        <section className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Service</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
              <Select
                className="w-full"
                value={{ value: svcForm.kind, label: svcForm.kind }}
                onChange={(opt) => setSvcForm({ ...svcForm, kind: opt.value })}
                options={[
                  { value: "HOSTING", label: "Hosting" },
                  { value: "DIGITAL_MARKETING", label: "Digital Marketing" },
                  { value: "OTHER", label: "Other" },
                ]}
                classNamePrefix="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
              <Select
                className="w-full"
                value={{ value: svcForm.billingType, label: svcForm.billingType }}
                onChange={(opt) => setSvcForm({ ...svcForm, billingType: opt.value })}
                options={[
                  { value: "MONTHLY", label: "Monthly" },
                  { value: "ONE_TIME", label: "One-Time" },
                ]}
                classNamePrefix="select"
              />
            </div>
            {svcForm.billingType === "MONTHLY" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount (GST excl.)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  type="number"
                  placeholder="Monthly Amount"
                  value={svcForm.amountMonthly}
                  onChange={(e) =>
                    setSvcForm({ ...svcForm, amountMonthly: Number(e.target.value) })
                  }
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">One-time Amount (GST excl.)</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  type="number"
                  placeholder="One-time Amount"
                  value={svcForm.amountOneTime}
                  onChange={(e) =>
                    setSvcForm({ ...svcForm, amountOneTime: Number(e.target.value) })
                  }
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                type="date"
                value={svcForm.startDate}
                onChange={(e) => setSvcForm({ ...svcForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                type="date"
                value={svcForm.expiryDate}
                onChange={(e) => setSvcForm({ ...svcForm, expiryDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[100px]"
                placeholder="Notes"
                value={svcForm.notes}
                onChange={(e) => setSvcForm({ ...svcForm, notes: e.target.value })}
              />
            </div>
            <button
              className={`w-full px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
                !canSubmitService || svcSaving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
              disabled={!canSubmitService || svcSaving}
              onClick={addService}
            >
              {svcSaving ? "Saving..." : "Add Service"}
            </button>
          </div>
          <h4 className="text-md font-semibold text-gray-800 mt-6 mb-3">Existing Services</h4>
          <div className="max-h-56 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Kind</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Billing</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Start</th>
                </tr>
              </thead>
              <tbody>
                {(client.services || []).slice().reverse().map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border-t">{s.kind}</td>
                    <td className="px-4 py-3 border-t">{s.billingType}</td>
                    <td className="px-4 py-3 border-t">
                      {s.billingType === "MONTHLY" ? s.amountMonthly : s.amountOneTime}
                    </td>
                    <td className="px-4 py-3 border-t">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
                {(client.services || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                      No services yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Credentials */}
        <section className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Credentials</h3>
            {credLoading && <span className="text-xs text-gray-500">Loading...</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Panel Name *</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Panel Name"
                value={credForm.panelName}
                onChange={(e) => setCredForm({ ...credForm, panelName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Project"
                value={credForm.projectName}
                onChange={(e) => setCredForm({ ...credForm, projectName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
              <Select
                className="w-full"
                value={{ value: credForm.environment, label: credForm.environment }}
                onChange={(opt) => setCredForm({ ...credForm, environment: opt.value })}
                options={[
                  { value: "PROD", label: "Production" },
                  { value: "STAGING", label: "Staging" },
                  { value: "DEV", label: "Development" },
                  { value: "OTHER", label: "Other" },
                ]}
                classNamePrefix="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="URL"
                value={credForm.url}
                onChange={(e) => setCredForm({ ...credForm, url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Username"
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                type="password"
                placeholder="Password"
                value={credForm.password}
                onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Tags (comma separated)"
                value={credForm.tags}
                onChange={(e) => setCredForm({ ...credForm, tags: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Notes"
                value={credForm.notes}
                onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={async () => {
                  await addCredential();
                  await loadClient();
                }}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + Add Credential
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-56 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Panel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Env</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">URL</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Tags</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cr) => (
                  <tr key={cr._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border-t font-medium">{cr.panelName}</td>
                    <td className="px-4 py-3 border-t">{cr.environment}</td>
                    <td className="px-4 py-3 border-t">{cr.username}</td>
                    <td className="px-4 py-3 border-t">
                      {cr.url ? (
                        <a
                          className="text-indigo-600 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                          href={cr.url}
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 border-t">{(cr.tags || []).join(", ") || "-"}</td>
                  </tr>
                ))}
                {credentials.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                      No credentials
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meetings */}
        <section className="bg-white shadow-sm rounded-lg p-6 border border-gray-200 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Meetings</h3>
            {meetLoading && <span className="text-xs text-gray-500">Loading...</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                type="datetime-local"
                value={meetingForm.meetingDate}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Title"
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Attendees (comma separated)</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Attendees"
                value={meetingForm.attendees}
                onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Remarks"
                value={meetingForm.remarks}
                onChange={(e) => setMeetingForm({ ...meetingForm, remarks: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="Summary"
                value={meetingForm.summary}
                onChange={(e) => setMeetingForm({ ...meetingForm, summary: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-Up</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                type="date"
                value={meetingForm.nextFollowUp}
                onChange={(e) => setMeetingForm({ ...meetingForm, nextFollowUp: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={addMeeting}
                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                + Save Meeting
              </button>
            </div>
          </div>
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">When</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Attendees</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 border-t">
                      {m.meetingDate ? new Date(m.meetingDate).toLocaleString() : "-"}
                      {m.nextFollowUp && (
                        <div className="text-xs text-amber-600">
                          Next: {new Date(m.nextFollowUp).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-t">
                      <div className="font-medium">{m.title || "-"}</div>
                      {m.summary && (
                        <div className="text-xs text-gray-500">{m.summary}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-t">
                      {(m.attendees || []).join(", ") || "-"}
                    </td>
                    <td className="px-4 py-3 border-t">{m.remarks || "-"}</td>
                  </tr>
                ))}
                {meetings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                      No meetings yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* React Select custom styles */}
      <style jsx>{`
        .select__control {
          @apply border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500;
        }
        .select__menu {
          @apply border-gray-300 rounded-lg shadow-lg;
        }
        .select__option--is-focused {
          @apply bg-indigo-50;
        }
        .select__option--is-selected {
          @apply bg-indigo-600 text-white;
        }
      `}</style>
    </div>
  );
}