import React, { useState } from "react";
import { apiPost } from "../lib/api";

export default function LoginPage({ baseUrl, onLogin, showToast = () => {} }) {
  const [step, setStep] = useState(1); // 1: identifier, 2: otp
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState("");

  const requestOtp = async () => {
    try {
      const idf = identifier.trim();
      if (!idf) return showToast({ type: "error", text: "Enter email or phone" });
      setLoading(true);
      const r = await apiPost(baseUrl, "/auth/request-otp", { identifier: idf });
      // In dev, API returns { dev_otp }
      if (r.dev_otp) setDevOtp(r.dev_otp);
      showToast({ type: "success", text: "OTP sent (check inbox / SMS)" });
      setStep(2);
    } catch (e) {
      showToast({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      const code = otp.trim();
      if (!code) return showToast({ type: "error", text: "Enter the OTP" });
      setLoading(true);
      const r = await apiPost(baseUrl, "/auth/verify-otp", { identifier: identifier.trim(), otp: code });
      localStorage.setItem("token", r.token);
      localStorage.setItem("user", JSON.stringify(r.user));
      onLogin?.(r.user);
      showToast({ type: "success", text: "Logged in" });
    } catch (e) {
      showToast({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setOtp("");
    setDevOtp("");
  };

  return (
    <div className="max-w-md mx-auto mt-16 border rounded-xl p-6 bg-white space-y-4">
      <h2 className="text-xl font-semibold">Sign in</h2>

      {step === 1 && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Email or Phone</label>
            <input
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
              placeholder="you@example.com or +91 98765 43210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <button
            onClick={requestOtp}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">OTP sent to <span className="font-medium">{identifier}</span></div>
            <button onClick={reset} className="text-xs underline text-slate-600">change</button>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Enter OTP</label>
            <input
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm tracking-widest"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
           
          </div>
          <button
            onClick={verifyOtp}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            {loading ? "Verifying…" : "Verify & Login"}
          </button>
        </>
      )}
    </div>
  );
}
