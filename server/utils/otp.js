import crypto from "crypto";

export function generateOtp(len = 6) {
  // 6-digit numeric OTP
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function hashOtp(otp, secret) {
  // HMAC keeps it simple and fast
  return crypto.createHmac("sha256", String(secret || "otp-secret")).update(String(otp)).digest("hex");
}

export function safeEqual(a, b) {
  const ab = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
