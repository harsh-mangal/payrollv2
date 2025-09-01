// server/routes/reports.js
import { Router } from "express";
import { netBalance } from "../controllers/reportController.js";
const r = Router();
r.get("/net-balance", netBalance);
export default r;
