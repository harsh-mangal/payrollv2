import React from "react";
import { NavLink } from "react-router-dom";

export default function Header({ baseUrl, setBaseUrl }) {
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
  return (
    <header className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Payroll V2 (BETA)
        </h1>
      
      </div>

      <button
        onClick={logout}
        className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-sm hover:bg-rose-200"
      >
        Logout
      </button>
    </header>
  );
}
