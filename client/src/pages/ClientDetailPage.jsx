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
  const [showPassword, setShowPassword] = useState({}); // State to toggle password visibility
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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
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

  // Toggle password visibility
  const togglePasswordVisibility = (id) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!client) {
    return (
      <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
        <Link
          to="/clients"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Clients
        </Link>
        <div className="mt-4 text-gray-600 animate-pulse">Loading client...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/clients"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Clients
        </Link>
        <h2 className="text-3xl font-bold text-gray-900 mt-3">{client.name}</h2>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span>{client.email || "No email"}</span>
          <span className="text-gray-400">•</span>
          <span>{client.phone || "No phone"}</span>
          <span className="text-gray-400">•</span>
          <span>GSTIN: {client.gstin || "N/A"}</span>
        </div>
      </div>

      {/* Month-wise Invoice */}
      <section className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Create Month-wise Invoice</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
            <Select
              className="w-full text-sm"
              value={{ value: invMonth, label: monthNames[invMonthNum - 1] }}
              onChange={(opt) => setInvMonth(opt.value)}
              options={monthNames.map((m, i) => ({ value: String(i + 1), label: m }))}
              classNamePrefix="select"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <input
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              type="number"
              min={2000}
              max={2100}
              value={invYear}
              onChange={(e) => setInvYear(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">GST Mode</label>
            <Select
              className="w-full text-sm"
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
            className={`sm:col-span-3 px-6 py-3 rounded-lg text-white text-sm font-semibold transition-all ${
              invCreating || !monthYearValid
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
            onClick={createMonthInvoiceFromServices}
            disabled={invCreating || !monthYearValid}
          >
            {invCreating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 11-16 0z"></path>
                </svg>
                Creating...
              </span>
            ) : (
              "Generate Invoice"
            )}
          </button>
        </div>
      </section>

      {/* Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Services */}
        <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100 lg:col-span-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Add New Service</h3>
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
              <Select
                className="w-full text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Billing Type</label>
              <Select
                className="w-full text-sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Amount (GST excl.)</label>
                <input
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  type="number"
                  placeholder="Enter monthly amount"
                  value={svcForm.amountMonthly}
                  onChange={(e) => setSvcForm({ ...svcForm, amountMonthly: Number(e.target.value) })}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">One-time Amount (GST excl.)</label>
                <input
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  type="number"
                  placeholder="Enter one-time amount"
                  value={svcForm.amountOneTime}
                  onChange={(e) => setSvcForm({ ...svcForm, amountOneTime: Number(e.target.value) })}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                type="date"
                value={svcForm.startDate}
                onChange={(e) => setSvcForm({ ...svcForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date (optional)</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                type="date"
                value={svcForm.expiryDate}
                onChange={(e) => setSvcForm({ ...svcForm, expiryDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[120px] transition-all"
                placeholder="Add service notes"
                value={svcForm.notes}
                onChange={(e) => setSvcForm({ ...svcForm, notes: e.target.value })}
              />
            </div>
            <button
              className={`w-full px-6 py-3 rounded-lg text-white text-sm font-semibold transition-all ${
                !canSubmitService || svcSaving
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
              disabled={!canSubmitService || svcSaving}
              onClick={addService}
            >
              {svcSaving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 11-16 0z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                "Add Service"
              )}
            </button>
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Existing Services</h4>
          <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Kind</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Billing</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Start</th>
                </tr>
              </thead>
              <tbody>
                {(client.services || []).slice().reverse().map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-t text-gray-600">{s.kind}</td>
                    <td className="px-4 py-3 border-t text-gray-600">{s.billingType}</td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      {s.billingType === "MONTHLY" ? s.amountMonthly : s.amountOneTime}
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString() : "N/A"}
                    </td>
                  </tr>
                ))}
                {(client.services || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                      No services added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Credentials */}
        <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Credentials</h3>
            {credLoading && <span className="text-sm text-gray-500 animate-pulse">Loading...</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Panel Name *</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter panel name"
                value={credForm.panelName}
                onChange={(e) => setCredForm({ ...credForm, panelName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter project name"
                value={credForm.projectName}
                onChange={(e) => setCredForm({ ...credForm, projectName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
              <Select
                className="w-full text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter URL"
                value={credForm.url}
                onChange={(e) => setCredForm({ ...credForm, url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter username"
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
              <div className="relative">
                <input
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  type="password"
                  placeholder="Enter password"
                  value={credForm.password}
                  onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma separated)</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter tags (e.g., admin, access)"
                value={credForm.tags}
                onChange={(e) => setCredForm({ ...credForm, tags: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[120px] transition-all"
                placeholder="Add credential notes"
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
                className="w-full px-6 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  Add Credential
                </span>
              </button>
            </div>
          </div>
          <div className="mt-6 max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Panel</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Env</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">URL</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Password</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tags</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cr) => (
                  <tr key={cr._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-t text-gray-600">{cr.panelName}</td>
                    <td className="px-4 py-3 border-t text-gray-600">{cr.environment}</td>
                    <td className="px-4 py-3 border-t text-gray-600">{cr.username}</td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      {cr.url ? (
                        <a
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                          target="_blank"
                          rel="noreferrer"
                          href={cr.url}
                        >
                          Open
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      <div className="flex items-center">
                        <span>{showPassword[cr._id] ? cr.password : "••••••••"}</span>
                        <button
                          onClick={() => togglePasswordVisibility(cr._id)}
                          className="ml-2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword[cr._id] ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">{(cr.tags || []).join(", ") || "N/A"}</td>
                  </tr>
                ))}
                {credentials.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                      No credentials added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meetings */}
        <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Meetings</h3>
            {meetLoading && <span className="text-sm text-gray-500 animate-pulse">Loading...</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Date</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                type="datetime-local"
                value={meetingForm.meetingDate}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter meeting title"
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Attendees (comma separated)</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                placeholder="Enter attendees (e.g., John Doe, Jane Smith)"
                value={meetingForm.attendees}
                onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[120px] transition-all"
                placeholder="Add meeting remarks"
                value={meetingForm.remarks}
                onChange={(e) => setMeetingForm({ ...meetingForm, remarks: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Summary</label>
              <textarea
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm min-h-[120px] transition-all"
                placeholder="Add meeting summary"
                value={meetingForm.summary}
                onChange={(e) => setMeetingForm({ ...meetingForm, summary: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Next Follow-Up</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                type="date"
                value={meetingForm.nextFollowUp}
                onChange={(e) => setMeetingForm({ ...meetingForm, nextFollowUp: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={addMeeting}
                className="w-full px-6 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  Save Meeting
                </span>
              </button>
            </div>
          </div>
          <div className="mt-6 max-h-72 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">When</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Attendees</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m._id} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3 border-t text-gray-600">
                      {m.meetingDate ? new Date(m.meetingDate).toLocaleString() : "N/A"}
                      {m.nextFollowUp && (
                        <div className="text-xs text-amber-600">
                          Next: {new Date(m.nextFollowUp).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      <div className="font-medium">{m.title || "N/A"}</div>
                      {m.summary && (
                        <div className="text-xs text-gray-500">{m.summary}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">
                      {(m.attendees || []).join(", ") || "N/A"}
                    </td>
                    <td className="px-4 py-3 border-t text-gray-600">{m.remarks || "N/A"}</td>
                  </tr>
                ))}
                {meetings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                      No meetings scheduled yet
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
          @apply border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all;
        }
        .select__menu {
          @apply border-gray-200 rounded-lg shadow-lg z-10;
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