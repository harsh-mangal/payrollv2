import React from "react";
import Section from "../components/Section";
import Payments from "../components/Payments";

export default function PaymentsPage(props) {
  return (
    <Section title="Record Payment / Advance (with slip)">
      <Payments {...props} />
    </Section>
  );
}
