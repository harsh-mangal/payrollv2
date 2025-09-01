
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateOtp, hashOtp, safeEqual } from "../utils/otp.js";
import { sendOtpEmail, sendOtpSms } from "../utils/notify.js";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRIES = 5;

const isEmail = (s) => /\S+@\S+\.\S+/.test(String(s).toLowerCase());
const isPhone = (s) => /^[0-9+\-() ]{6,20}$/.test(String(s)); // simple

export const requestOtp = async (req, res) => {
  try {
    const raw = (req.body.identifier || "").trim();
    if (!raw) return res.status(400).json({ ok: false, error: "IDENTIFIER_REQUIRED" });

    const identifier = raw.toLowerCase(); // normalize emails
    let user = await User.findOne({ identifier });
    if (!user) {
      user = await User.create({ identifier, name: "", role: "ADMIN" }); // first user as admin; adjust as needed
    }

    const otp = generateOtp(6);
    const otpHash = hashOtp(otp, process.env.OTP_SECRET || "otp-secret");
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    user.otpHash = otpHash;
    user.otpExpiresAt = otpExpiresAt;
    user.otpTries = 0;
    await user.save();

    let delivered = false;
    if (isEmail(identifier)) delivered = await sendOtpEmail({ to: identifier, otp });
    else if (isPhone(identifier)) delivered = await sendOtpSms({ to: identifier, otp });

    // In dev, you can echo OTP to help testing
    const echo = process.env.NODE_ENV !== "production" ? { dev_otp: otp } : {};
    res.json({ ok: true, delivered, ...echo });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const identifier = (req.body.identifier || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!identifier || !otp) {
      return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
    }

    const user = await User.findOne({ identifier });
    if (!user || !user.otpHash) {
      return res.status(400).json({ ok: false, error: "OTP_REQUIRED" });
    }

    if (user.otpTries >= MAX_TRIES) {
      return res.status(429).json({ ok: false, error: "OTP_TRIES_EXCEEDED" });
    }
    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: "OTP_EXPIRED" });
    }

    const expected = user.otpHash;
    const provided = hashOtp(otp, process.env.OTP_SECRET || "otp-secret");
    const ok = safeEqual(expected, provided);

    user.otpTries += 1;

    if (!ok) {
      await user.save();
      return res.status(400).json({ ok: false, error: "OTP_INVALID" });
    }

    // success: clear OTP and issue JWT
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpTries = 0;
    await user.save();

    const token = jwt.sign(
      { uid: String(user._id), idf: user.identifier, role: user.role },
      process.env.JWT_SECRET || "dev-jwt",
      { expiresIn: "7d" }
    );

    res.json({
      ok: true,
      token,
      user: { id: String(user._id), identifier: user.identifier, name: user.name, role: user.role },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
};

export const me = async (req, res) => {
  res.json({ ok: true, user: req.user });
};
