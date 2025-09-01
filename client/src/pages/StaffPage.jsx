// src/pages/StaffPage.jsx
import React from "react";
import StaffPayroll from "../components/StaffPayroll";

export default function StaffPage({ baseUrl, showToast }) {
  return (
    <div className="space-y-4">
      <StaffPayroll baseUrl={baseUrl} showToast={showToast} />
    </div>
  );
}
