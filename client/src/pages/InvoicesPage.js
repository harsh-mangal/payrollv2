import React from "react";
import Section from "../components/Section";
import Invoices from "../components/Invoices";

export default function InvoicesPage(props) {
  return (
    <Section title="Create Invoice (GST modes)">
      <Invoices {...props} />
    </Section>
  );
}
