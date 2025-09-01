import React from "react";

export default function Section({ title, children, right }) {
  return (
    <section className="bg-white rounded-2xl shadow p-4 md:p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
