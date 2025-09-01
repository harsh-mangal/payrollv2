import React from "react";
import Section from "../components/Section";
import Ledger from "../components/Ledger";

export default function LedgerPage({ ledger, onExport, onRefresh }) {
  return (
    <Section title="Client Ledger">
      <Ledger ledger={ledger} onExport={onExport} onRefresh={onRefresh} />
    </Section>
  );
}
    