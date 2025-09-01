import { Router } from "express";
import { requestOtp, verifyOtp, me } from "../controllers/authController.js";
import requireAuth from "../middleware/requireAuth.js";

const r = Router();

r.post("/auth/request-otp", requestOtp);
r.post("/auth/verify-otp", verifyOtp);
r.get("/auth/me", requireAuth, me);

export default r;
