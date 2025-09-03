import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import Select from "react-select";


// ---------- utils ----------
const toNum = (v) => (v === "" || v == null ? 0 : Number(v));
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const months = [
  { v: 1, label: "January" },
  { v: 2, label: "February" },
  { v: 3, label: "March" },
  { v: 4, label: "April" },
  { v: 5, label: "May" },
  { v: 6, label: "June" },
  { v: 7, label: "July" },
  { v: 8, label: "August" },
  { v: 9, label: "September" },
  { v: 10, label: "October" },
  { v: 11, label: "November" },
  { v: 12, label: "December" },
];

// ---------- main component ----------
export default function StaffPayroll({ baseUrl, showToast = () => { } }) {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);

  const [showNewStaff, setShowNewStaff] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    phone: "",
    email: "",
    designation: "",
    joinDate: "",
    salaryBase: "",
    bankAccount: { bankName: "", accountNo: "", ifsc: "", holderName: "" },
    upiId: "",
    notes: "",
  });

  const [advanceForm, setAdvanceForm] = useState({
    amount: "",
    date: "",
    remarks: "",
  });
  const [recordingAdvance, setRecordingAdvance] = useState(false);

  const todayYYYYMMDD = new Date().toISOString().slice(0, 10);
  const [payrollForm, setPayrollForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic: "",
    hra: "",
    otherAllowances: "",
    pf: "",
    tds: "",
    advanceRecovery: "",
    otherDeductions: "",
    paidOn: todayYYYYMMDD,
    payMode: "OTHER",
    remarks: "",
    slipNo: "",
  });
  const [paying, setPaying] = useState(false);

  const [ledger, setLedger] = useState([]);
  const [balance, setBalance] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // ------ load staff ------
  async function loadStaff() {
    try {
      setLoading(true);
      const data = await apiGet(baseUrl, "/staff");
      if (!data?.ok) throw new Error(data?.error || "Failed to fetch staff");
      setStaff(data.staff || []);
      // reset selection if removed
      if (selectedStaffId) {
        const s = (data.staff || []).find((x) => x._id === selectedStaffId);
        if (!s) {
          setSelectedStaffId("");
          setSelectedStaff(null);
          setLedger([]);
          setBalance(0);
        }
      }
    } catch (e) {
      showToast({ type: "error", text: e.message || "Error loading staff" });
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(staffId) {
    if (!staffId) return;
    try {
      setLedgerLoading(true);
      const data = await apiGet(baseUrl, `/staff/${staffId}/ledger`);
      if (!data?.ok) throw new Error(data?.error || "Failed to fetch ledger");
      setLedger(data.ledger || []);
      setBalance(Number(data.balance || 0));
    } catch (e) {
      showToast({ type: "error", text: e.message || "Error loading ledger" });
    } finally {
      setLedgerLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedStaffId) {
      setSelectedStaff(null);
      setLedger([]);
      setBalance(0);
      return;
    }
    const s = staff.find((x) => x._id === selectedStaffId) || null;
    setSelectedStaff(s);
    loadLedger(selectedStaffId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, staff]);

  // ------ new staff ------
  async function createStaff() {
    try {
      if (!staffForm.name.trim()) {
        showToast({ type: "error", text: "Name is required" });
        return;
      }
      setCreatingStaff(true);
      const payload = {
        ...staffForm,
        salaryBase: toNum(staffForm.salaryBase),
        joinDate: staffForm.joinDate || undefined,
      };
      const data = await apiPost(baseUrl, "/staff", payload);
      if (!data?.ok) throw new Error(data?.error || "Failed to create staff");
      showToast({ type: "success", text: "Staff created" });
      setShowNewStaff(false);
      setStaffForm({
        name: "",
        phone: "",
        email: "",
        designation: "",
        joinDate: "",
        salaryBase: "",
        bankAccount: { bankName: "", accountNo: "", ifsc: "", holderName: "" },
        upiId: "",
        notes: "",
      });
      await loadStaff();
      setSelectedStaffId(data.staff?._id || "");
    } catch (e) {
      showToast({ type: "error", text: e.message || "Create failed" });
    } finally {
      setCreatingStaff(false);
    }
  }

  // ------ record advance ------
  async function recordAdvance() {
    try {
      if (!selectedStaffId) {
        showToast({ type: "error", text: "Select a staff first" });
        return;
      }
      const amt = toNum(advanceForm.amount);
      if (!(amt > 0)) {
        showToast({ type: "error", text: "Enter a valid amount" });
        return;
      }
      setRecordingAdvance(true);
      const payload = {
        amount: amt,
        date: advanceForm.date || undefined,
        remarks: advanceForm.remarks || undefined,
      };
      const data = await apiPost(baseUrl, `/staff/${selectedStaffId}/advance`, payload);
      if (!data?.ok) throw new Error(data?.error || "Failed to record advance");
      showToast({ type: "success", text: "Advance recorded" });
      setAdvanceForm({ amount: "", date: "", remarks: "" });
      await loadLedger(selectedStaffId);
    } catch (e) {
      showToast({ type: "error", text: e.message || "Advance failed" });
    } finally {
      setRecordingAdvance(false);
    }
  }

  // ------ salary calc ------
  const salaryTotals = useMemo(() => {
    const gross = round2(
      toNum(payrollForm.basic) +
      toNum(payrollForm.hra) +
      toNum(payrollForm.otherAllowances)
    );
    const totalDeductions = round2(
      toNum(payrollForm.pf) +
      toNum(payrollForm.tds) +
      toNum(payrollForm.advanceRecovery) +
      toNum(payrollForm.otherDeductions)
    );
    const netPay = round2(gross - totalDeductions);
    return { gross, totalDeductions, netPay };
  }, [payrollForm]);

  // ------ pay salary ------
  async function paySalary() {
    try {
      if (!selectedStaffId) {
        showToast({ type: "error", text: "Select a staff first" });
        return;
      }
      if (!payrollForm.month || !payrollForm.year) {
        showToast({ type: "error", text: "Month and Year are required" });
        return;
      }
      if (salaryTotals.netPay < 0) {
        showToast({ type: "error", text: "Net Pay cannot be negative" });
        return;
      }

      setPaying(true);
      const payload = {
        month: toNum(payrollForm.month),
        year: toNum(payrollForm.year),
        basic: toNum(payrollForm.basic),
        hra: toNum(payrollForm.hra),
        otherAllowances: toNum(payrollForm.otherAllowances),
        pf: toNum(payrollForm.pf),
        tds: toNum(payrollForm.tds),
        advanceRecovery: toNum(payrollForm.advanceRecovery),
        otherDeductions: toNum(payrollForm.otherDeductions),
        paidOn: payrollForm.paidOn || undefined,
        payMode: payrollForm.payMode,
        remarks: payrollForm.remarks || undefined,
        slipNo: payrollForm.slipNo || undefined,
      };
      const data = await apiPost(baseUrl, `/staff/${selectedStaffId}/payroll`, payload);
      if (!data?.ok) throw new Error(data?.error || "Payroll failed");

      showToast({ type: "success", text: `Salary paid. Net: ₹${salaryTotals.netPay.toFixed(2)}` });
      await loadLedger(selectedStaffId);

      // Offer slip
      if (data.slipUrl) {
        window.open(data.slipUrl, "_blank");
      }

      // Reset entry amounts but keep month/year
      setPayrollForm((f) => ({
        ...f,
        basic: "",
        hra: "",
        otherAllowances: "",
        pf: "",
        tds: "",
        advanceRecovery: "",
        otherDeductions: "",
        remarks: "",
        slipNo: "",
      }));
    } catch (e) {
      showToast({ type: "error", text: e.message || "Payment failed" });
    } finally {
      setPaying(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Staff & Payroll</h2>
        <div className="flex gap-2">
          <button
            onClick={loadStaff}
            className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={() => setShowNewStaff((s) => !s)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {showNewStaff ? "Close New Staff" : "Add Staff"}
          </button>
        </div>
      </div>

      {/* New Staff Form */}
      {showNewStaff && (
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextInput label="Name *" value={staffForm.name}
              onChange={(v) => setStaffForm({ ...staffForm, name: v })} />
            <TextInput label="Designation" value={staffForm.designation}
              onChange={(v) => setStaffForm({ ...staffForm, designation: v })} />
            <TextInput label="Phone" value={staffForm.phone}
              onChange={(v) => setStaffForm({ ...staffForm, phone: v })} />
            <TextInput label="Email" value={staffForm.email}
              onChange={(v) => setStaffForm({ ...staffForm, email: v })} />
            <DateInput label="Join Date" value={staffForm.joinDate}
              onChange={(v) => setStaffForm({ ...staffForm, joinDate: v })} />
            <NumberInput label="Salary Base (Monthly)" value={staffForm.salaryBase}
              onChange={(v) => setStaffForm({ ...staffForm, salaryBase: v })} />

            <TextInput label="Bank Name" value={staffForm.bankAccount.bankName}
              onChange={(v) => setStaffForm({ ...staffForm, bankAccount: { ...staffForm.bankAccount, bankName: v } })} />
            <TextInput label="Account No." value={staffForm.bankAccount.accountNo}
              onChange={(v) => setStaffForm({ ...staffForm, bankAccount: { ...staffForm.bankAccount, accountNo: v } })} />
            <TextInput label="IFSC" value={staffForm.bankAccount.ifsc}
              onChange={(v) => setStaffForm({ ...staffForm, bankAccount: { ...staffForm.bankAccount, ifsc: v } })} />
            <TextInput label="Account Holder" value={staffForm.bankAccount.holderName}
              onChange={(v) => setStaffForm({ ...staffForm, bankAccount: { ...staffForm.bankAccount, holderName: v } })} />
            <TextInput label="UPI ID" value={staffForm.upiId}
              onChange={(v) => setStaffForm({ ...staffForm, upiId: v })} />
            <TextInput label="Notes" value={staffForm.notes}
              onChange={(v) => setStaffForm({ ...staffForm, notes: v })} />
          </div>

          <div className="mt-4">
            <button
              onClick={createStaff}
              disabled={creatingStaff}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              {creatingStaff ? "Creating…" : "Create Staff"}
            </button>
          </div>
        </div>
      )}

      {/* Staff Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1 border rounded-xl p-3 bg-white">
          <div className="text-sm font-medium mb-2">Staff</div>
          <Select
            className="text-sm"
            options={staff.map((s) => ({
              value: s._id,
              label: `${s.name}${s.designation ? ` — ${s.designation}` : ""}`,
            }))}
            value={staff
              .filter((s) => s._id === selectedStaffId)
              .map((s) => ({ value: s._id, label: `${s.name}${s.designation ? ` — ${s.designation}` : ""}` }))}
            onChange={(opt) => setSelectedStaffId(opt ? opt.value : "")}
            placeholder="Select staff…"
            isClearable
          />

          {selectedStaff && (
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              <div><span className="font-medium">Name:</span> {selectedStaff.name}</div>
              {selectedStaff.designation && <div><span className="font-medium">Role:</span> {selectedStaff.designation}</div>}
              {selectedStaff.salaryBase != null && <div><span className="font-medium">Base Salary:</span> ₹ {Number(selectedStaff.salaryBase || 0).toFixed(2)}</div>}
              {selectedStaff.phone && <div><span className="font-medium">Phone:</span> {selectedStaff.phone}</div>}
              {selectedStaff.email && <div><span className="font-medium">Email:</span> {selectedStaff.email}</div>}
            </div>
          )}
        </div>

        {/* Advance Form */}
        <div className="md:col-span-1 border rounded-xl p-3 bg-white">
          <div className="text-sm font-medium mb-2">Record Advance</div>
          <NumberInput label="Amount" value={advanceForm.amount}
            onChange={(v) => setAdvanceForm({ ...advanceForm, amount: v })} />
          <DateInput label="Date" value={advanceForm.date}
            onChange={(v) => setAdvanceForm({ ...advanceForm, date: v })} />
          <TextInput label="Remarks" value={advanceForm.remarks}
            onChange={(v) => setAdvanceForm({ ...advanceForm, remarks: v })} />
          <div className="mt-2">
            <button
              onClick={recordAdvance}
              disabled={recordingAdvance || !selectedStaffId}
              className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-800 text-sm hover:bg-slate-300 disabled:opacity-50"
            >
              {recordingAdvance ? "Saving…" : "Save Advance"}
            </button>
          </div>
        </div>

        {/* Payroll Form */}
        <div className="md:col-span-1 border rounded-xl p-3 bg-white">
          <div className="text-sm font-medium mb-2">Pay Salary</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-600">Month</label>
              <Select
                className="text-sm"
                options={months.map((m) => ({ value: m.v, label: m.label }))}
                value={months.find((m) => m.v === payrollForm.month)}
                onChange={(opt) =>
                  setPayrollForm((f) => ({ ...f, month: opt ? opt.value : "" }))
                }
                placeholder="Select month…"
              />

            </div>
            <NumberInput
              label="Year"
              value={payrollForm.year}
              onChange={(v) => setPayrollForm((f) => ({ ...f, year: v }))}
            />
            <NumberInput label="Basic" value={payrollForm.basic}
              onChange={(v) => setPayrollForm((f) => ({ ...f, basic: v }))} />
            <NumberInput label="HRA" value={payrollForm.hra}
              onChange={(v) => setPayrollForm((f) => ({ ...f, hra: v }))} />
            <NumberInput label="Other Allowances" value={payrollForm.otherAllowances}
              onChange={(v) => setPayrollForm((f) => ({ ...f, otherAllowances: v }))} />
            <NumberInput label="PF" value={payrollForm.pf}
              onChange={(v) => setPayrollForm((f) => ({ ...f, pf: v }))} />
            <NumberInput label="TDS" value={payrollForm.tds}
              onChange={(v) => setPayrollForm((f) => ({ ...f, tds: v }))} />
            <NumberInput label="Advance Recovery" value={payrollForm.advanceRecovery}
              onChange={(v) => setPayrollForm((f) => ({ ...f, advanceRecovery: v }))} />
            <NumberInput label="Other Deductions" value={payrollForm.otherDeductions}
              onChange={(v) => setPayrollForm((f) => ({ ...f, otherDeductions: v }))} />
            <DateInput label="Paid On" value={payrollForm.paidOn}
              onChange={(v) => setPayrollForm((f) => ({ ...f, paidOn: v }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-600">Pay Mode</label>
              <Select
                className="text-sm"
                options={[
                  { value: "OTHER", label: "Other" },
                  { value: "CASH", label: "Cash" },
                  { value: "BANK", label: "Bank" },
                  { value: "UPI", label: "UPI" },
                ]}
                value={[
                  { value: "OTHER", label: "Other" },
                  { value: "CASH", label: "Cash" },
                  { value: "BANK", label: "Bank" },
                  { value: "UPI", label: "UPI" },
                ].find((opt) => opt.value === payrollForm.payMode)}
                onChange={(opt) =>
                  setPayrollForm((f) => ({ ...f, payMode: opt ? opt.value : "OTHER" }))
                }
                placeholder="Select pay mode…"
              />

            </div>
            <TextInput label="Slip No. (optional)" value={payrollForm.slipNo}
              onChange={(v) => setPayrollForm((f) => ({ ...f, slipNo: v }))} />
            <TextInput label="Remarks" value={payrollForm.remarks}
              onChange={(v) => setPayrollForm((f) => ({ ...f, remarks: v }))} />
          </div>

          {/* Salary summary */}
          <div className="mt-3 text-sm bg-slate-50 border rounded-xl p-3 space-y-1">
            <div className="flex justify-between"><span>Gross</span><span>₹ {salaryTotals.gross.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Total Deductions</span><span>₹ {salaryTotals.totalDeductions.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold"><span>Net Pay</span><span>₹ {salaryTotals.netPay.toFixed(2)}</span></div>
          </div>

          <div className="mt-3">
            <button
              onClick={paySalary}
              disabled={paying || !selectedStaffId}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {paying ? "Paying…" : "Pay Salary"}
            </button>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="border rounded-xl p-4 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Staff Ledger</div>
          <div className="text-sm">
            <span className="font-semibold">Running Balance:</span>{" "}
            ₹ {Number(balance || 0).toFixed(2)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-slate-50">
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2 text-right">Amount (₹)</th>
                <th className="py-2 px-2 text-right">Balance (₹)</th>
                <th className="py-2 px-2">Reference</th>
                <th className="py-2 px-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {ledgerLoading ? (
                <tr><td className="py-3 px-2" colSpan={6}>Loading…</td></tr>
              ) : ledger.length === 0 ? (
                <tr><td className="py-3 px-2" colSpan={6}>No entries yet</td></tr>
              ) : (
                ledger.map((e) => (
                  <tr key={e._id} className="border-t">
                    <td className="py-2 px-2">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${e.type === "DEBIT" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">{Number(e.amount || 0).toFixed(2)}</td>
                    <td className="py-2 px-2 text-right">{Number(e.balanceAfter || 0).toFixed(2)}</td>
                    <td className="py-2 px-2">{e.refType || ""}</td>
                    <td className="py-2 px-2">{e.remarks || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- small field components ----------
function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, step = "0.01", min }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        type="number"
        step={step}
        min={min}
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function DateInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        type="date"
        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
