import { Router } from "express";
import {
  createInvoice,
  getInvoicePdf,
  createInvoiceFromServices,
} from "../controllers/invoiceController.js";

const r = Router();

r.post("/", createInvoice);
r.post("/from-services", createInvoiceFromServices);
r.get("/:invoiceId/pdf", getInvoicePdf);

export default r;
