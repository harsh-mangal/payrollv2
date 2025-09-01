// server/utils/notify.js
import nodemailer from "nodemailer";

function pickEnv(...keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  return undefined;
}

export async function sendOtpEmail({ to, otp }) {
  const host = pickEnv("SMTP_HOST", "MAIL_HOST", "EMAIL_HOST") || "smtp.gmail.com";
  const port = Number(pickEnv("SMTP_PORT", "MAIL_PORT", "EMAIL_PORT") || 587);
  const user = pickEnv("SMTP_USER", "MAIL_USER", "EMAIL_USER");
  const pass = pickEnv("SMTP_PASS", "MAIL_PASS", "EMAIL_PASS");
  const from = pickEnv("SMTP_FROM", "MAIL_FROM", "EMAIL_FROM") || user;

  if (!user || !pass) {
    // Not configured; return false so the caller can decide what to do
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false, // TLS via STARTTLS on 587
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Your Login OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
  });

  return true;
}

// Optional: Twilio SMS remains as previously shown
export async function sendOtpSms() {
  return false; // no-op unless you configure Twilio
}
