import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import clientRoutes from './routes/clients.js';
import invoiceRoutes from './routes/invoices.js';
import paymentRoutes from './routes/payments.js';
import shareRoutes from './routes/share.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ensure uploads dir
const UP = path.resolve('uploads');
if (!fs.existsSync(UP)) fs.mkdirSync(UP);

app.use('/uploads', express.static(UP));

// routes
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/share', shareRoutes);

const PORT = process.env.PORT || 3010;
mongoose.connect(process.env.MONGO_URL).then(() => {
  app.listen(PORT, () => console.log('✅ Server @', PORT));
});
