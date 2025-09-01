import React from "react";

export default function Toast({ toast }) {
  if (!toast) return null;
  const color =
    toast.type === "success"
      ? "bg-emerald-600"
      : toast.type === "error"
      ? "bg-rose-600"
      : "bg-slate-700";
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-lg text-white ${color}`}>
      {toast.text}
    </div>
  );
}
