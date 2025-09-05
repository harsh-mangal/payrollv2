import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { getPayments, recordPayment } from '../controllers/paymentController.js';

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads'),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `payment_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

const r = Router();
r.post('/', upload.single('slip'), recordPayment);
r.get('/', getPayments);
export default r;
