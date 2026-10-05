import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const revalidate = 300;
export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>
        <strong>Draft for review.</strong> To be completed by the business owner before launch.
      </p>
      <h2>This website</h2>
      <p>
        This site describes our services and lets you contact us. Nothing on it is a quote, contract or guarantee. Any engagement
        starts with a conversation and is governed by a separate written agreement.
      </p>
      <h2>Offers</h2>
      <p>
        Any special offer is shown on this site only while it is active, and is subject to its stated conditions and expiry.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms: use the contact address in the page footer.</p>
    </LegalPage>
  );
}
