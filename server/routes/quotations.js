// server/routes/quotations.js
import { Router } from "express";
import {
  createQuotation,
  listQuotations,
  getQuotationPdf,
  updateQuotationStatus,
  convertQuotationToInvoice,
} from "../controllers/quotationController.js";

const r = Router();

r.post("/", createQuotation);
r.get("/", listQuotations);
r.get("/:quotationId/pdf", getQuotationPdf);
r.patch("/:quotationId/status", updateQuotationStatus);
r.post("/:quotationId/convert-to-invoice", convertQuotationToInvoice);

export default r;
