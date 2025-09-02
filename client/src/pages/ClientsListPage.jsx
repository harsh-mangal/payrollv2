import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../lib/api";

export default function ClientsListPage({ baseUrl, clients, reloadClients, showToast }) {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", gstin: "", openingBalance: 0,
  });

  async function createClient() {
    try {
      setSaving(true);
      await apiPost(baseUrl, "/clients", { ...form, openingBalance: Number(form.openingBalance || 0) });
      showToast({ type: "success", text: "Client created" });
      setForm({ name: "", email: "", phone: "", address: "", gstin: "", openingBalance: 0 });
      reloadClients();
    } catch (e) {
      showToast({ type: "error", text: e.message || "Failed to create client" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Create Client</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
        <input className="input" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})}/>
        <input className="input" placeholder="GSTIN" value={form.gstin} onChange={(e)=>setForm({...form, gstin:e.target.value})}/>
        <input className="input md:col-span-2" placeholder="Address" value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})}/>
        <div className="md:col-span-2 flex items-center gap-3">
          <input type="number" className="input w-48" placeholder="Opening Balance" value={form.openingBalance} onChange={(e)=>setForm({...form, openingBalance:Number(e.target.value)})}/>
          <button onClick={createClient} disabled={saving || !form.name} className="btn-primary">{saving ? "Saving…" : "Create Client"}</button>
        </div>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-3">Clients</h2>
      <div className="max-h-80 overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="th">Name</th>
              <th className="th">Phone</th>
              <th className="th">GSTIN</th>
              <th className="th">Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c._id} className="hover:bg-slate-50 cursor-pointer" onClick={()=>nav(`/clients/${c._id}`)}>
                <td className="td font-medium">{c.name}</td>
                <td className="td">{c.phone || "-"}</td>
                <td className="td">{c.gstin || "-"}</td>
                <td className="td">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No clients yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .input { @apply px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full; }
        .btn-primary { @apply px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700; }
        .th { @apply text-left px-3 py-2 font-medium text-slate-600; }
        .td { @apply px-3 py-2 border-t; }
      `}</style>
    </>
  );
}
