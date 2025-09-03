import React from "react";
import Section from "../components/Section";
import Ledger from "../components/Ledger";

export default function LedgerPage({ ledger, onExport, onRefresh }) {
  if (!ledger || !ledger.length) {
    return (
      <Section title="Client Ledgers">
        <p className="text-sm text-slate-500">No ledgers available.</p>
      </Section>
    );
  }

  return (
    <Section title="Client Ledgers">
      {ledger.map((l) => (
        <div key={l.client._id} className="mb-8">
          <h3 className="text-base font-semibold mb-2">{l.client.name}</h3>
          <Ledger ledger={l} onExport={onExport} onRefresh={onRefresh} />
        </div>
      ))}
    </Section>
  );
}
