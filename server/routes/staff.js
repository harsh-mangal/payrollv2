
import { Router } from 'express';
import {
  createStaff, updateStaff, getStaff, listStaff,
  recordAdvance, paySalary, getSalarySlip, getStaffLedger
} from '../controllers/staffController.js';

const r = Router();

// Staff CRUD
r.post('/staff', createStaff);
r.put('/staff/:staffId', updateStaff);
r.get('/staff/:staffId', getStaff);
r.get('/staff', listStaff);

// Advance & Payroll
r.post('/staff/:staffId/advance', recordAdvance);
r.post('/staff/:staffId/payroll', paySalary);
r.get('/staff/payroll/:payrollId/pdf', getSalarySlip);

// Ledger
r.get('/staff/:staffId/ledger', getStaffLedger);

export default r;
