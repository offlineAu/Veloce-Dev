import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { LegalPage, LegalSection, LegalReviewNote } from "@/components/site/legal-page";
import { getCompanyProfile } from "@/server/services/company";
import { CLOSED_RECORD_RETENTION_NOTICE } from "@/lib/privacy-retention";
import { env } from "@/config/env";

export const revalidate = 300;
export const metadata = pageMetadata("Privacy notice", "How Veloce handles inquiries, referrals, meeting bookings, submitted designs and browser storage.", "/privacy");

export default async function PrivacyPage() {
  const c = await getCompanyProfile();
  const e = env();
  const email = e.PRIVACY_CONTACT_EMAIL ?? e.COMPANY_CONTACT_EMAIL;
  const emailProvider = e.EMAILJS_SERVICE_ID && e.EMAILJS_TEMPLATE_ID && e.EMAILJS_PUBLIC_KEY && e.EMAILJS_PRIVATE_KEY
    ? "EmailJS and the email service connected to our EmailJS account"
    : e.RESEND_API_KEY && e.NOTIFY_FROM_EMAIL ? "Resend" : null;
  return (
    <LegalPage title="Privacy notice" kind="privacy" contactEmail={email}>
      <LegalReviewNote>The freelancer’s identity, provider details, external-copy retention and applicable legal grounds must be confirmed before public launch. Unconfirmed details are marked below.</LegalReviewNote>
      <LegalSection kind="privacy" id="responsibility">
        <p>{c.name} is an independent freelance development practice based in the Philippines. This website is operated by {e.LEGAL_ENTITY_NAME ?? "[Freelancer’s full name to be confirmed]"}, who is responsible for the personal information described here.</p>
        <p>Contact address: {e.LEGAL_BUSINESS_ADDRESS ?? "[Contact address in the Philippines to be confirmed]"}. For privacy questions or requests, email <a href={`mailto:${email}`} className="underline">{email}</a>.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="collection">
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Inquiries and consultations:</strong> your name, email, optional company and website, project type, goals, and details you choose to provide.</li>
          <li><strong>Introductions:</strong> the referrer&apos;s name and email, the introduced person&apos;s name, email, optional company, project interest and message. The referrer confirms permission to share those details.</li>
          <li><strong>Meetings:</strong> discussion context, name, email, selected time, timezone, meeting location, booking identifiers and status. Cal.com collects booking details when you use the scheduler.</li>
          <li><strong>Designs:</strong> if you send a builder design, we store its pages, text, asset references, layout and template information with your inquiry.</li>
          <li><strong>Attribution:</strong> referral campaign, landing path and campaign parameters supplied with an inquiry or booking, where present.</li>
          <li><strong>Optional analytics:</strong> if you allow it, a random browser identifier, a session identifier, normalized pages, page departure and visit duration, broad device category, coarse traffic source, campaign labels and sales actions. If you separately choose request linking, we associate this activity with your submitted request using a reference. Names, emails, form answers and private link tokens are not sent to analytics.</li>
          <li><strong>Security and delivery:</strong> keyed hashes of IP addresses and email addresses for abuse prevention and notification records, consent timestamps, notice version, purpose, and email delivery status. Developer uploads also record the developer name and a keyed IP hash.</li>
        </ul>
        <p>Our application uses a keyed hash of your IP address for rate limiting rather than saving the raw IP in that record. Hosting, network and scheduling providers may process IP addresses and request information in their own systems.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="purpose">
        <p>We use submitted details to respond to your request, review a design, follow up on an introduction, arrange and manage a meeting, and send relevant confirmations. We use campaign information to associate a request with its source, and technical records to prevent abuse, secure the service and monitor message delivery.</p>
        <p>The form asks for permission for its stated purpose. You can decline by leaving the form unsubmitted. You can withdraw consent by contacting us; withdrawal does not change processing already lawfully carried out and may prevent us from continuing the requested follow-up. Security, legal obligations and any processing under another lawful basis must be assessed under applicable Philippine law before launch.</p>
        <p>We do not sell submitted personal information or add you to a mailing list. Any future marketing signup will require a separate choice.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="recipients">
        <p>The freelancer handles requests. Website hosting: {e.LEGAL_HOSTING_PROVIDER ?? "[Provider to be confirmed]"}. Database hosting: {e.LEGAL_DATABASE_PROVIDER ?? "[Provider to be confirmed]"}.</p>
        <p>{emailProvider ? `Website confirmation and team notification emails are sent through ${emailProvider}. The configured mailbox provider also processes received messages.` : "Website notification email delivery is not currently configured. Emails you send directly are processed by our mailbox provider."}</p>
        <p>When enabled, the meeting scheduler is provided by <a href="https://cal.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">Cal.com</a>. It loads after the booking consent step and receives connection information, discussion context and the details you enter. It returns booking details to us and may use connected calendar, meeting and email services to fulfil your booking. You can request a meeting by email instead.</p>
        <p>Optional analytics is processed by <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">PostHog</a> through our server. The PostHog browser library loads only after your analytics choice is accepted. We filter its events before delivery, and use a private owner dashboard to view aggregate reports. The default configuration uses its EU region; actual region and provider arrangements must be confirmed before enabling collection. We do not forward your raw IP or user-agent to PostHog and disable IP-based geolocation. We do not collect session recordings or heatmaps.</p>
        <p>Information may be processed outside your country. Provider processing locations and transfer arrangements: {e.LEGAL_PROCESSING_LOCATIONS ?? "[To be confirmed for hosting, database, email, scheduling and connected providers]"}.</p>
        <p>This notice covers this Veloce website. Hosting, databases and other providers chosen for a client’s project are documented separately for that project. Changes to providers handling this website’s information will be reflected in this notice.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="previews">
        <p>Sending a design uploads a snapshot and creates a preview accessible to anyone with its link, without signing in. The link is included in our team notification. Treat it as a shared link rather than confidential storage. Avoid including passwords, sensitive records or personal information you do not have permission to share. Contact us to request deletion of the stored design and preview.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="storage">
        <p>We use local storage for theme and animation choices and for builder drafts, saved sections and templates. Session storage remembers the opening animation and temporary performance settings. Persistent browser data remains until you clear it or the site replaces it; session data normally ends when its browsing session ends. Clearing site data may remove unsent designs and saved preferences.</p>
        <p>A restricted developer session uses a security cookie after a developer signs in. When analytics is enabled, we ask before collecting optional visitor analytics. Declining does not affect forms or bookings. Analytics preferences in the footer lets you change this choice. Accepted analytics uses a signed HTTP-only cookie and browser storage for consent, attribution and sessions, with consent lasting up to one year. Request linking is a separate optional choice on each form. Declining or withdrawing stops browser collection and future server tracking once the withdrawal reaches our server; offline withdrawals are retried when you reconnect. Withdrawal does not itself erase previously collected data. Third-party scheduler storage is governed by its own notice.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="retention">
        <p>{CLOSED_RECORD_RETENTION_NOTICE}</p>
        <p>Deletion is performed by the scheduled cleanup following the 30-day period. Confirmed meeting records, contracts, invoices and records subject to a retention hold are excluded from this routine inquiry cleanup and require separate retention review. Closing a conversation does not cancel a booking.</p>
        <p>Mailbox copies, Cal.com and connected-provider records, hosting logs and backups are outside this website database cleanup. Their deletion procedures and backup expiry periods must be confirmed with the relevant providers before launch. Unsent browser drafts remain on your device until you remove them or clear site data.</p>
        <p>PostHog keeps an external copy of analytics under the configured project’s retention policy; the free plan currently provides one-year event retention, which is not a promise of erasure exactly after one year. We keep local consent and request references until external deletion is verified. Expired consent and eligible closed records enter the analytics deletion queue. Routine cleanup pauses deletion of affected request records until the owner confirms provider erasure. Ask us to delete analytics using the contact address above; this also stops further tracking for the associated browser identity. Shared-browser activity may be included in that deletion.</p>
        <p>Rate-limit records become eligible for opportunistic cleanup once their window is more than 24 hours old. Cleanup runs during some incoming requests, so this is not a guarantee of deletion within one day. A booking session&apos;s access expiry does not itself delete the stored record. Browser drafts are stored separately from a submitted design.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="rights">
        <p>Depending on applicable law, you may request access, correction, erasure or blocking, object to processing, withdraw consent, or request a portable copy of your information. Email <a href={`mailto:${email}`} className="underline">{email}</a> with enough detail to identify your request. We may need proportionate identity verification; do not send identity documents unless requested through an agreed channel. Some records may need to be kept to meet legal obligations.</p>
        <p>If someone introduced you, you can ask us about the information and its source or ask us not to follow up. Under Philippine privacy law, you can raise a complaint with the <a href="https://privacy.gov.ph/data-subject-rights/" target="_blank" rel="noopener noreferrer" className="underline">National Privacy Commission</a>. Other applicable regulators may also be available.</p>
      </LegalSection>
      <LegalSection kind="privacy" id="changes">
        <p>We will update the date and version when this notice changes and seek a new choice where required for a new purpose. See our <Link href="/terms" className="underline">terms of use</Link> for website and builder use.</p>
      </LegalSection>
    </LegalPage>
  );
}
