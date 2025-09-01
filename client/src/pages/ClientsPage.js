import React from "react";
import Section from "../components/Section";
import Clients from "../components/Clients";

export default function ClientsPage(props) {
  return (
    <Section title="Clients">
      <Clients {...props} />
    </Section>
  );
}
