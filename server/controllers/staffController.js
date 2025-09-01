    import fs from 'fs';
    import path from 'path';
    import Staff from '../models/Staff.js';
    import StaffLedgerEntry from '../models/StaffLedgerEntry.js';
    import SalaryPayment from '../models/SalaryPayment.js';
    import { getStaffCurrentBalance } from '../utils/staffBalance.js';
    import { generateSalarySlipPDF } from '../utils/salaryPdf.js';

    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

    const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
    };

    /* -------------------- Staff CRUD -------------------- */

    export const createStaff = async (req, res) => {
    try {
        const staff = await Staff.create(req.body);
        res.json({ ok: true, staff });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    export const updateStaff = async (req, res) => {
    try {
        const staff = await Staff.findByIdAndUpdate(req.params.staffId, req.body, { new: true });
        if (!staff) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        res.json({ ok: true, staff });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    export const getStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.staffId);
        if (!staff) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        res.json({ ok: true, staff });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    export const listStaff = async (_req, res) => {
    try {
        const rows = await Staff.find().sort({ createdAt: -1 });
        res.json({ ok: true, staff: rows });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    /* -------------------- Ledger helpers -------------------- */

    async function addLedger({ staffId, type, amount, refType, refId, remarks }) {
    const prev = await getStaffCurrentBalance(staffId);
    const amt = Number(amount || 0);
    const balanceAfter = type === 'DEBIT' ? round2(prev + amt) : round2(prev - amt);
    const row = await StaffLedgerEntry.create({
        staffId, date: new Date(), type, amount: amt, balanceAfter, refType, refId, remarks,
    });
    return { row, balanceAfter };
    }

    /* -------------------- Advances -------------------- */

    export const recordAdvance = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { amount, date, remarks } = req.body;
        const staff = await Staff.findById(staffId);
        if (!staff) return res.status(404).json({ ok: false, error: 'STAFF_NOT_FOUND' });

        const { row, balanceAfter } = await addLedger({
        staffId,
        type: 'DEBIT',                 // money given to staff
        amount,
        refType: 'ADVANCE',
        refId: undefined,
        remarks: remarks || 'Salary advance',
        });

        res.json({ ok: true, ledger: row, balanceAfter });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    /* -------------------- Pay Salary & Slip -------------------- */

    export const paySalary = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staff = await Staff.findById(staffId);
        if (!staff) return res.status(404).json({ ok: false, error: 'STAFF_NOT_FOUND' });

        const {
        month, year,
        basic = 0, hra = 0, otherAllowances = 0,
        pf = 0, tds = 0, advanceRecovery = 0, otherDeductions = 0,
        paidOn, payMode = 'OTHER', remarks, slipNo,
        } = req.body;

        if (!month || !year) {
        return res.status(400).json({ ok: false, error: 'MONTH_YEAR_REQUIRED' });
        }

        // Prevent double-pay for same month/year
        const exists = await SalaryPayment.findOne({ staffId, month, year });
        if (exists) {
        return res.status(400).json({ ok: false, error: 'ALREADY_PAID_FOR_MONTH' });
        }

        const gross = round2(Number(basic) + Number(hra) + Number(otherAllowances));
        const totalDeductions = round2(Number(pf) + Number(tds) + Number(advanceRecovery) + Number(otherDeductions));
        const netPay = round2(gross - totalDeductions);
        if (netPay < 0) return res.status(400).json({ ok: false, error: 'NET_PAY_NEGATIVE' });

        // Save salary payment
        const pay = await SalaryPayment.create({
        staffId, month, year,
        basic, hra, otherAllowances,
        pf, tds, advanceRecovery, otherDeductions,
        gross, totalDeductions, netPay,
        paidOn: paidOn ? new Date(paidOn) : new Date(),
        payMode, remarks, slipNo,
        });

        // Ledger entries:
        // 1) DEBIT for net pay (amount paid to staff)
        const debit = await addLedger({
        staffId,
        type: 'DEBIT',
        amount: netPay,
        refType: 'SALARY',
        refId: pay._id,
        remarks: `Salary for ${String(month).padStart(2, '0')}/${year}`,
        });

        // 2) CREDIT for advance recovery (if any)
        if (Number(advanceRecovery) > 0) {
        await addLedger({
            staffId,
            type: 'CREDIT',
            amount: advanceRecovery,
            refType: 'RECOVERY',
            refId: pay._id,
            remarks: `Advance recovery for ${String(month).padStart(2, '0')}/${year}`,
        });
        }

        // Generate PDF slip
        const dir = ensureDir(path.resolve('uploads', 'salary-slips'));
        const fileName = pay.slipNo
        ? `${pay.slipNo}.pdf`
        : `SAL-${year}-${String(month).padStart(2, '0')}-${pay._id}.pdf`;
        const outPath = path.join(dir, fileName);

        await generateSalarySlipPDF(
        {
            staff,
            payment: pay.toObject(),
            org: {
            name: process.env.ORG_NAME || 'Dodun Soft Solutions',
            address: process.env.ORG_ADDRESS || '',
            phone: process.env.ORG_PHONE || '',
            email: process.env.ORG_EMAIL || '',
            },
        },
        outPath
        );

        pay.slipPath = outPath;
        await pay.save();

        const slipUrl = `${process.env.BASE_URL}/uploads/salary-slips/${fileName}`;

        res.json({
        ok: true,
        payment: pay,
        ledgerAfter: debit.balanceAfter,
        slipUrl,
        });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    /* -------------------- Get Slip URL -------------------- */
    export const getSalarySlip = async (req, res) => {
    try {
        const { payrollId } = req.params;
        const pay = await SalaryPayment.findById(payrollId).populate('staffId', 'name');
        if (!pay) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
        if (!pay.slipPath) return res.status(404).json({ ok: false, error: 'SLIP_NOT_READY' });
        const fileName = path.basename(pay.slipPath);
        const slipUrl = `${process.env.BASE_URL}/uploads/salary-slips/${fileName}`;
        res.json({ ok: true, url: slipUrl, staff: pay.staffId?.name, month: pay.month, year: pay.year });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };

    /* -------------------- Staff Ledger -------------------- */
    export const getStaffLedger = async (req, res) => {
    try {
        const { staffId } = req.params;
        const rows = await StaffLedgerEntry.find({ staffId }).sort({ date: 1, createdAt: 1 });
        const current = await getStaffCurrentBalance(staffId);
        res.json({ ok: true, ledger: rows, balance: current });
    } catch (e) {
        res.status(400).json({ ok: false, error: e.message });
    }
    };
