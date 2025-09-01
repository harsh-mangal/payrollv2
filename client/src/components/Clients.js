import React, { useState } from "react";
import { apiPost } from "../lib/api";

export default function Clients({ baseUrl, clients, selectedClientId, setSelectedClientId, showToast, reloadClients }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", gstin: "", openingBalance: 0,
  });

  async function createClient() {
    try {
      setSaving(true);
      await apiPost(baseUrl, "/clients", form);
      showToast({ type: "success", text: "Client created" });
      setForm({ name: "", email: "", phone: "", address: "", gstin: "", openingBalance: 0 });
      reloadClients();
    } catch (e) {
      showToast({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" placeholder="Name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
        <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
        <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" placeholder="Phone" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})}/>
        <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" placeholder="GSTIN" value={form.gstin} onChange={(e)=>setForm({...form, gstin:e.target.value})}/>
        <input className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:col-span-2" placeholder="Address" value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})}/>
        <div className="md:col-span-2 flex items-center gap-3">
          <input type="number" className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" placeholder="Opening Balance" value={form.openingBalance} onChange={(e)=>setForm({...form, openingBalance:Number(e.target.value)})}/>
          <button onClick={createClient} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">{saving ? "Saving…" : "Create Client"}</button>
        </div>
      </div>

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
              <tr key={c._id} className="hover:bg-slate-50 cursor-default" onClick={()=>setSelectedClientId(c._id)}>
                <td className="px-3 py-2 border-t font-medium">{c.name}</td>
                <td className="px-3 py-2 border-t">{c.phone || "-"}</td>
                <td className="px-3 py-2 border-t">{c.gstin || "-"}</td>
                <td className="px-3 py-2 border-t">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
