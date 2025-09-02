import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

export default function Clients({
  baseUrl,
  clients,
  selectedClientId,
  setSelectedClientId,
  showToast,
  reloadClients,
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gstin: "",
    openingBalance: 0,
  });

  // ---- right panel: selected client data ----
  const [credLoading, setCredLoading] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetings, setMeetings] = useState([]);

  // ---- add credential form ----
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

  // ---- add meeting form ----
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: "",
    title: "",
    attendees: "",
    remarks: "",
    summary: "",
    nextFollowUp: "",
  });
  const [actionDraft, setActionDraft] = useState({ description: "", owner: "", dueDate: "" });
  const [actionItems, setActionItems] = useState([]);

  const selectedClient = useMemo(
    () => clients.find((c) => c._id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  async function createClient() {
    try {
      setSaving(true);
      await apiPost(baseUrl, "/clients", {
        ...form,
        openingBalance: Number(form.openingBalance || 0),
      });
      showToast({ type: "success", text: "Client created" });
      setForm({
        name: "",
        email: "",
        phone: "",
        address: "",
        gstin: "",
        openingBalance: 0,
      });
      reloadClients();
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to create client" });
    } finally {
      setSaving(false);
    }
  }

  // ---- load credentials + meetings on selection ----
  useEffect(() => {
    if (!selectedClientId) return;
    (async () => {
      try {
        setCredLoading(true);
        const cRes = await apiGet(baseUrl, `/clients/${selectedClientId}/credentials`);
        setCredentials(cRes.credentials || []);
      } catch (e) {
        showToast({ type: "error", text: "Failed to load credentials" });
      } finally {
        setCredLoading(false);
      }
      try {
        setMeetLoading(true);
        const mRes = await apiGet(baseUrl, `/clients/${selectedClientId}/meetings`);
        setMeetings(mRes.meetings || []);
      } catch (e) {
        showToast({ type: "error", text: "Failed to load meetings" });
      } finally {
        setMeetLoading(false);
      }
    })();
  }, [baseUrl, selectedClientId, showToast]);

  // ---- submit credential ----
  async function addCredential() {
    if (!selectedClientId) return;
    if (!credForm.panelName || !credForm.username || !credForm.password) {
      showToast({ type: "error", text: "Panel, Username, and Password are required" });
      return;
    }
    try {
      setCredLoading(true);
      const payload = {
        ...credForm,
        tags: credForm.tags
          ? credForm.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };
      const res = await apiPost(baseUrl, `/clients/${selectedClientId}/credentials`, payload);
      setCredentials(res.client?.credentials || []);
      showToast({ type: "success", text: "Credential added" });
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
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to add credential" });
    } finally {
      setCredLoading(false);
    }
  }

  // ---- meeting: action items builder ----
  function addActionDraft() {
    if (!actionDraft.description) {
      showToast({ type: "error", text: "Action description required" });
      return;
    }
    setActionItems((prev) => [...prev, { ...actionDraft }]);
    setActionDraft({ description: "", owner: "", dueDate: "" });
  }
  function removeActionItem(i) {
    setActionItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ---- submit meeting ----
  async function addMeeting() {
    if (!selectedClientId) return;
    try {
      setMeetLoading(true);
      const payload = {
        ...meetingForm,
        meetingDate: meetingForm.meetingDate ? new Date(meetingForm.meetingDate) : new Date(),
        nextFollowUp: meetingForm.nextFollowUp ? new Date(meetingForm.nextFollowUp) : undefined,
        attendees: meetingForm.attendees
          ? meetingForm.attendees
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        actionItems: actionItems.map((a) => ({
          ...a,
          dueDate: a.dueDate ? new Date(a.dueDate) : undefined,
          status: "OPEN",
        })),
      };
      const res = await apiPost(baseUrl, `/clients/${selectedClientId}/meetings`, payload);
      setMeetings(res.client?.meetings || []);
      showToast({ type: "success", text: "Meeting saved" });
      setMeetingForm({
        meetingDate: "",
        title: "",
        attendees: "",
        remarks: "",
        summary: "",
        nextFollowUp: "",
      });
      setActionItems([]);
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to add meeting" });
    } finally {
      setMeetLoading(false);
    }
  }

  return (
    <>
      {/* Create Client */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
          placeholder="GSTIN"
          value={form.gstin}
          onChange={(e) => setForm({ ...form, gstin: e.target.value })}
        />
        <input
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:col-span-2"
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <div className="md:col-span-2 flex items-center gap-3">
          <input
            type="number"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            placeholder="Opening Balance"
            value={form.openingBalance}
            onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
          />
          <button
            onClick={createClient}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {saving ? "Saving…" : "Create Client"}
          </button>
        </div>
      </div>

      {/* Clients list */}
      <div className="mt-4 max-h-64 overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Name</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Phone</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">GSTIN</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c._id}
                className={`hover:bg-slate-50 cursor-pointer ${
                  selectedClientId === c._id ? "bg-indigo-50" : ""
                }`}
                onClick={() => setSelectedClientId(c._id)}
              >
                <td className="px-3 py-2 border-t font-medium">{c.name}</td>
                <td className="px-3 py-2 border-t">{c.phone || "-"}</td>
                <td className="px-3 py-2 border-t">{c.gstin || "-"}</td>
                <td className="px-3 py-2 border-t">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right panel: credentials + meetings for selected client */}
      {selectedClient && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credentials */}
          <section className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Credentials — {selectedClient.name}</h3>
              {credLoading && <span className="text-xs text-slate-500">Loading…</span>}
            </div>

            {/* Add credential form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Panel Name *"
                value={credForm.panelName}
                onChange={(e) => setCredForm({ ...credForm, panelName: e.target.value })}
              />
              <input
                className="input"
                placeholder="Project Name"
                value={credForm.projectName}
                onChange={(e) => setCredForm({ ...credForm, projectName: e.target.value })}
              />
              <select
                className="input"
                value={credForm.environment}
                onChange={(e) => setCredForm({ ...credForm, environment: e.target.value })}
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
                onChange={(e) => setCredForm({ ...credForm, url: e.target.value })}
              />
              <input
                className="input"
                placeholder="Username *"
                value={credForm.username}
                onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
              />
              <input
                className="input"
                placeholder="Password *"
                type="password"
                value={credForm.password}
                onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Tags (comma separated)"
                value={credForm.tags}
                onChange={(e) => setCredForm({ ...credForm, tags: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Notes"
                value={credForm.notes}
                onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
              />
              <div className="md:col-span-2">
                <button onClick={addCredential} className="btn-primary">
                  + Add Credential
                </button>
              </div>
            </div>

            {/* Credential list */}
            <div className="mt-4 max-h-56 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Panel</th>
                    <th className="px-3 py-2 text-left">Project</th>
                    <th className="px-3 py-2 text-left">Env</th>
                    <th className="px-3 py-2 text-left">Username</th>
                    <th className="px-3 py-2 text-left">URL</th>
                    <th className="px-3 py-2 text-left">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((cr) => (
                    <tr key={cr._id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border-t font-medium">{cr.panelName}</td>
                      <td className="px-3 py-2 border-t">{cr.projectName || "-"}</td>
                      <td className="px-3 py-2 border-t">{cr.environment}</td>
                      <td className="px-3 py-2 border-t">{cr.username}</td>
                      <td className="px-3 py-2 border-t">
                        {cr.url ? (
                          <a href={cr.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">
                            open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2 border-t">
                        {(cr.tags || []).join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                  {credentials.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                        No credentials yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Meetings */}
          <section className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Meetings — {selectedClient.name}</h3>
              {meetLoading && <span className="text-xs text-slate-500">Loading…</span>}
            </div>

            {/* Add meeting form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input"
                type="datetime-local"
                value={meetingForm.meetingDate}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
              />
              <input
                className="input"
                placeholder="Title"
                value={meetingForm.title}
                onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Attendees (comma separated)"
                value={meetingForm.attendees}
                onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Remarks"
                value={meetingForm.remarks}
                onChange={(e) => setMeetingForm({ ...meetingForm, remarks: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Summary"
                value={meetingForm.summary}
                onChange={(e) => setMeetingForm({ ...meetingForm, summary: e.target.value })}
              />
              <input
                className="input"
                type="date"
                value={meetingForm.nextFollowUp}
                onChange={(e) => setMeetingForm({ ...meetingForm, nextFollowUp: e.target.value })}
              />

              {/* Action items builder */}
              <div className="md:col-span-2 border rounded-lg p-3">
                <div className="font-medium mb-2">Action Items</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className="input"
                    placeholder="Description"
                    value={actionDraft.description}
                    onChange={(e) =>
                      setActionDraft((s) => ({ ...s, description: e.target.value }))
                    }
                  />
                  <input
                    className="input"
                    placeholder="Owner"
                    value={actionDraft.owner}
                    onChange={(e) => setActionDraft((s) => ({ ...s, owner: e.target.value }))}
                  />
                  <input
                    className="input"
                    type="date"
                    value={actionDraft.dueDate}
                    onChange={(e) => setActionDraft((s) => ({ ...s, dueDate: e.target.value }))}
                  />
                </div>
                <div className="mt-2">
                  <button onClick={addActionDraft} className="btn-secondary">
                    + Add item
                  </button>
                </div>

                {actionItems.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {actionItems.map((ai, i) => (
                      <li key={i} className="flex items-center justify-between rounded border p-2">
                        <div>
                          <div className="font-medium">{ai.description}</div>
                          <div className="text-xs text-slate-500">
                            Owner: {ai.owner || "-"}{" "}
                            {ai.dueDate ? `• Due: ${ai.dueDate}` : ""}
                          </div>
                        </div>
                        <button
                          onClick={() => removeActionItem(i)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="md:col-span-2">
                <button onClick={addMeeting} className="btn-primary">
                  + Save Meeting
                </button>
              </div>
            </div>

            {/* Meeting list */}
            <div className="mt-4 max-h-56 overflow-auto rounded-lg border">
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
                      <td className="px-3 py-2 border-t">
                        {m.meetingDate ? new Date(m.meetingDate).toLocaleString() : "-"}
                        {m.nextFollowUp && (
                          <div className="text-xs text-amber-700">
                            Next: {new Date(m.nextFollowUp).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 border-t">
                        <div className="font-medium">{m.title || "-"}</div>
                        {m.summary && <div className="text-xs text-slate-500">{m.summary}</div>}
                      </td>
                      <td className="px-3 py-2 border-t">
                        {(m.attendees || []).join(", ") || "-"}
                      </td>
                      <td className="px-3 py-2 border-t">
                        <div>{m.remarks || "-"}</div>
                        {Array.isArray(m.actionItems) && m.actionItems.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {m.actionItems.map((ai, i) => (
                              <li key={i} className="text-xs">
                                • {ai.description}{" "}
                                <span className="text-slate-500">
                                  {ai.owner ? `(${ai.owner})` : ""}
                                  {ai.dueDate ? ` • due ${new Date(ai.dueDate).toLocaleDateString()}` : ""}
                                  {ai.status ? ` • ${ai.status}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                  {meetings.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                        No meetings yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Tiny utility styles (Tailwind helpers) */}
      <style>{`
        .input {
          @apply px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full;
        }
        .btn-primary {
          @apply px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700;
        }
        .btn-secondary {
          @apply px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200;
        }
      `}</style>
    </>
  );
}
