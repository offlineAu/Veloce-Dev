import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const revalidate = 300;
export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice">
      <p>
        <strong>Draft for review.</strong> This notice describes what this website actually does today. It must be reviewed and
        completed by the business owner (and legal counsel where required) before launch, including the controller&apos;s legal
        name, address, retention period and your rights contact.
      </p>
      <h2>What we collect</h2>
      <p>
        <strong>Project inquiries:</strong> name, email, optional company and website, and the project details you type.
        <br />
        <strong>Referral introductions:</strong> the referrer&apos;s name and email, the introduced person&apos;s name, email and optional
        company, the project interest, and an optional message. The referrer confirms they have the other person&apos;s permission.
        <br />
        <strong>Technical:</strong> a keyed hash of your IP address, used only for rate limiting and abuse prevention and deleted
        automatically within a day. We do not store raw IP addresses.
        <br />
        <strong>Referral links:</strong> if you arrive through a referral link, the submission is linked to that link&apos;s campaign.
      </p>
      <h2>How we use it</h2>
      <p>
        To reply to your inquiry or follow up on an introduction, and to send you a confirmation where described on the form.
        We do not add anyone to a mailing list, sell data, or use it for marketing without separate consent.
      </p>
      <h2>Who sees it</h2>
      <p>Our team, and the service providers that host the site, store the data and send email on our behalf.</p>
      <h2>How long we keep it</h2>
      <p>[Retention period to be set by the business owner.]</p>
      <h2>Your rights and contact</h2>
      <p>To ask what we hold about you, correct it, or have it deleted, email the contact address in the page footer.</p>
    </LegalPage>
  );
}
