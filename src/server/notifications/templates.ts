import { env } from "@/config/env";
import { brand } from "@/content/site";
import { escapeHtml as h } from "@/lib/utils";

export interface Message {
  subject: string;
  text: string;
  html: string;
}

const FONT = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Site palette (see globals.css). Email clients can't read CSS variables, so the values are inlined here. */
const C = {
  page: "#f5ead8", // --color-bg
  card: "#ffffff",
  bannerFrom: "#fbf1de",
  line: "#e6d9c0",
  ink: "#201e1d",
  muted: "#645c50",
  faint: "#9a8f7e",
  accent: "#c67139", // --color-accent
  accentFill: "#a8582a", // --color-accent-600: button fill with white text
  accentDeep: "#8c491a", // --color-accent-700: accent text on light grounds
  pillBg: "#ffe1d0", // --color-accent-200
  chipBg: "#fff2eb", // --color-accent-100
  chipLine: "#ffc6a5", // --color-accent-300
  boxBg: "#faf4e8",
} as const;

interface Layout {
  /** Small pill above the headline. */
  eyebrow: string;
  title: string;
  /** Sentence under the headline, inside the banner. */
  subtitle?: string;
  /** Hidden inbox-preview text. */
  preheader: string;
  bodyHtml: string;
}

/**
 * Gmail and Outlook block SVG and embedded images, so the logo must be a PNG at a public https URL.
 * On localhost (or any non-public URL) no mail client can fetch it, so we fall back to the text wordmark.
 */
function logoSrc(): string | undefined {
  try {
    const u = new URL("/brand/veloce-logo-original.png", env().NEXT_PUBLIC_SITE_URL);
    const local = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(u.hostname) || u.hostname.endsWith(".local");
    return u.protocol === "https:" && !local ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function wrap(company: string, l: Layout): string {
  const logo = logoSrc();
  const brandRow = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${
    logo
      ? `<td style="padding-right:10px;vertical-align:middle"><img src="${h(logo)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:18px;border:0"></td>`
      : ""
  }<td style="vertical-align:middle;font-weight:800;font-size:20px;color:${C.ink}">${h(company)}<span style="color:${C.accent}">.</span></td></tr></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${h(l.title)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT};color:${C.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${C.page}">${h(l.preheader)}</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;text-align:left">
<tr><td style="padding-bottom:24px">${brandRow}</td></tr>
<tr><td style="background:${C.card};border-radius:20px;border:1px solid ${C.line};overflow:hidden">
<div style="padding:32px 32px 24px;background:${C.bannerFrom};background-image:linear-gradient(135deg,${C.bannerFrom} 0%,${C.card} 100%);border-bottom:1px solid ${C.line}">
<span style="display:inline-block;background:${C.pillBg};color:${C.accentDeep};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 12px;border-radius:20px;margin-bottom:12px">${h(l.eyebrow)}</span>
<h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${C.ink}">${h(l.title)}</h1>${
    l.subtitle ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:${C.muted}">${h(l.subtitle)}</p>` : ""
  }</div>
<div style="padding:24px 32px 32px;font-size:15px;line-height:1.6;color:${C.ink}">${l.bodyHtml}</div>
</td></tr>
<tr><td style="padding-top:24px;text-align:center;font-size:12px;line-height:1.6;color:${C.muted}">
<p style="margin:0;font-weight:700;color:${C.ink}">${h(company)} <span style="font-weight:400;color:${C.muted}">&middot; ${h(brand.tagline)}</span></p>
<p style="margin:4px 0 0;font-size:11px;color:${C.faint}">You are receiving this because a form was submitted on our website.</p>
</td></tr></table></td></tr></table></body></html>`;
}

const rows = (pairs: [string, string | undefined][]) =>
  pairs.filter((p): p is [string, string] => !!p[1]);

// How each field is drawn. Anything not listed is a plain bold value.
const CHIPS = new Set(["Project type", "Advice topic", "Website type", "Asked about", "Interested in"]);
const BLOCKS = new Set(["Goals", "Question or decision", "Details", "Message"]);
const META = new Set(["Request", "Source", "Campaign"]);
const LINKS: Record<string, (v: string) => string> = {
  Email: (v) => `mailto:${v}`,
  Website: (v) => v,
};

const DASH = `border-bottom:1px dashed ${C.line};`;

function details(pairs: [string, string | undefined][]) {
  const r = rows(pairs);
  const body = r
    .map(([k, v]) => {
      if (BLOCKS.has(k)) {
        return `<tr><td colspan="2" style="padding:16px 0 6px;font-size:13px;font-weight:600;color:${C.muted}">${h(k)}</td></tr><tr><td colspan="2" style="padding-bottom:16px;${DASH}"><div style="background:${C.boxBg};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.5;color:${C.ink};white-space:pre-wrap">${h(v)}</div></td></tr>`;
      }
      if (META.has(k)) {
        return `<tr><td style="padding:10px 0 0;width:35%;font-size:12px;font-weight:600;color:${C.muted}">${h(k)}</td><td style="padding:10px 0 0;font-size:12px;color:${C.muted}">${h(v)}</td></tr>`;
      }
      const label = `<td style="padding:10px 0;${DASH}width:35%;vertical-align:top;font-size:13px;font-weight:600;color:${C.muted}">${h(k)}</td>`;
      if (CHIPS.has(k)) {
        return `<tr>${label}<td style="padding:8px 0;${DASH}"><span style="display:inline-block;background:${C.chipBg};border:1px solid ${C.chipLine};color:${C.accentDeep};font-size:12px;font-weight:600;padding:4px 10px;border-radius:6px">${h(v)}</span></td></tr>`;
      }
      const href = LINKS[k]?.(v);
      const value = href
        ? `<a href="${h(href)}" style="color:${C.accentDeep};font-weight:600;text-decoration:none">${h(v)}</a>`
        : `<span style="font-weight:700;color:${C.ink};white-space:pre-wrap">${h(v)}</span>`;
      return `<tr>${label}<td style="padding:10px 0;${DASH}vertical-align:top;font-size:14px">${value}</td></tr>`;
    })
    .join("");
  return {
    text: r.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">${body}</table>`,
  };
}

function button(label: string, href: string): string {
  return `<div style="padding-top:24px"><a href="${h(href)}" style="display:inline-block;background:${C.accentFill};color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:14px 28px;border-radius:50px">${h(label)} &nbsp;&rarr;</a></div>`;
}

function steps(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0">${items
    .map(
      (t, i) =>
        `<tr><td style="width:36px;padding:8px 0;vertical-align:top"><div style="width:28px;height:28px;border-radius:14px;background:${C.pillBg};color:${C.accentDeep};font-weight:700;font-size:14px;line-height:28px;text-align:center">${i + 1}</div></td><td style="padding:8px 0;vertical-align:top;font-size:14px;line-height:1.55">${h(t)}</td></tr>`,
    )
    .join("")}</table>`;
}

const small = (t: string) =>
  `<p style="margin:24px 0 0;padding-top:16px;border-top:1px dashed ${C.line};font-size:12px;line-height:1.6;color:${C.muted}">${t}</p>`;

const heading = (t: string) =>
  `<p style="margin:0;font-size:11px;letter-spacing:.5px;text-transform:uppercase;font-weight:700;color:${C.accentDeep}">${h(t)}</p>`;

export interface LeadEmailData {
  company: string;
  name: string;
  email: string;
  companyName?: string;
  website?: string;
  projectType: string;
  websiteType?: string;
  service?: string;
  goals: string;
  details?: string;
  intent: string;
  source: string;
  campaignName?: string;
  /** Read-only preview of a page the visitor designed in the site builder. */
  draftUrl?: string;
  draftPages?: number;
}

export function leadTeamEmail(d: LeadEmailData): Message {
  if (d.intent === "MEETING") {
    const t = details([["Name", d.name], ["Email", d.email], ["Discussion", d.goals], ["Source", d.source], ["Campaign", d.campaignName]]);
    return {
      subject: `Meeting request from ${d.name}`,
      text: `A meeting was requested. No time has been reserved. Reply to arrange a time.\n\n${t.text}`,
      html: wrap(d.company, { eyebrow: "Meeting request", title: `${d.name} would like to meet`, subtitle: "No time has been reserved. Reply to arrange a meeting.", preheader: "A new meeting request needs a reply.", bodyHtml: `${t.html}${button("Reply to arrange a meeting", `mailto:${d.email}`)}` }),
    };
  }
  const consultation = d.intent === "CONSULTATION";
  const request = consultation ? "consultation request" : "project inquiry";
  const t = details([
    ["Name", d.name],
    ["Email", d.email],
    ["Company", d.companyName],
    ["Website", d.website],
    [consultation ? "Advice topic" : "Project type", d.projectType],
    ["Website type", d.websiteType],
    ["Asked about", d.service],
    [consultation ? "Question or decision" : "Goals", d.goals],
    ["Details", d.details],
    ["Request", d.intent === "CONSULTATION" ? "Consultation" : "Conversation"],
    ["Source", d.source],
    ["Campaign", d.campaignName],
    ["Site design", d.draftUrl ? `${d.draftPages && d.draftPages > 1 ? `${d.draftPages} pages: ` : ""}${d.draftUrl}` : undefined],
  ]);
  const first = d.name.split(" ")[0] ?? d.name;
  return {
    subject: consultation ? `Consultation request from ${d.name}` : `New inquiry from ${d.name}`,
    text: `A new ${request} was submitted.\n\n${t.text}`,
    html: wrap(d.company, {
      eyebrow: consultation ? "Consultation request" : "New inquiry",
      title: `${d.name} wants to ${consultation ? "book a consultation" : "start a project"}`,
      subtitle: `A new ${request} was submitted via your website form. ${consultation ? "Reply to clarify the question and confirm the consultation scope and any cost." : "Reply directly to start the conversation."}`,
      preheader: `${d.projectType}: ${d.goals}`.slice(0, 110),
      bodyHtml: `${t.html}${d.draftUrl ? button("View their site design", d.draftUrl) : ""}${button(`Reply to ${first}`, `mailto:${d.email}`)}`,
    }),
  };
}

export function leadAckEmail(d: { company: string; name: string; intent?: string }): Message {
  const first = d.name.split(" ")[0] ?? d.name;
  if (d.intent === "MEETING") {
    return {
      subject: "We received your meeting request",
      text: `Hi ${first},\n\n${d.company} received your meeting request. No appointment time has been reserved. Our team will reply to arrange a time and confirm the meeting details.`,
      html: wrap(d.company, { eyebrow: "Meeting request received", title: `Thanks, ${first}.`, preheader: "We'll reply to arrange a meeting time.", bodyHtml: `<p>${h(d.company)} received your meeting request. No appointment time has been reserved. Our team will reply to arrange a time and confirm the meeting details.</p>` }),
    };
  }
  if (d.intent === "CONSULTATION") {
    const next = [
      "We review your question and the background you shared.",
      "We reply by email to clarify the topic and arrange a consultation.",
      "We confirm the scope and any cost before you commit.",
    ];
    return {
      subject: "We received your consultation request",
      text: `Hi ${first},\n\nThanks for getting in touch with ${d.company}. We've received your consultation request.\n\nWhat happens next:\n${next.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n\nIf you didn't send this request, you can ignore this message.`,
      html: wrap(d.company, {
        eyebrow: "Consultation request received",
        title: `Thanks, ${first}. We've got your question.`,
        preheader: "We'll reply by email to arrange your consultation.",
        bodyHtml: `<p style="margin:0 0 16px">Thanks for getting in touch with ${h(d.company)}. We've received your consultation request.</p>${heading("What happens next")}${steps(next)}${small("If you didn't send this request, you can safely ignore this message.")}`,
      }),
    };
  }
  return {
    subject: `We received your inquiry`,
    text: `Hi ${first},\n\nThanks for getting in touch with ${d.company}. We've received your inquiry and will reply to this email address to arrange a first conversation.\n\nWhat happens next:\n1. We read your inquiry carefully.\n2. We reply here with a few questions or a time to talk.\n3. Together we decide the simplest way to get you a working result.\n\nIf you didn't send this inquiry, you can ignore this message.`,
    html: wrap(d.company, {
      eyebrow: "Inquiry received",
      title: `Thanks, ${first}. We've got it.`,
      preheader: "We'll reply to this address to arrange a first conversation.",
      bodyHtml: `<p style="margin:0 0 16px">Thanks for getting in touch with ${h(d.company)}. We've received your inquiry and will reply to this email address to arrange a first conversation.</p>${heading("What happens next")}${steps([
        "We read your inquiry carefully.",
        "We reply here with a few questions or a time to talk.",
        "Together we decide the simplest way to get you a working result.",
      ])}${small("If you didn't send this inquiry, you can safely ignore this message.")}`,
    }),
  };
}

export interface IntroEmailData {
  company: string;
  referrerName: string;
  referrerEmail: string;
  referredName: string;
  referredEmail: string;
  referredCompany?: string;
  interest: string;
  message?: string;
  campaignName?: string;
}

export function introTeamEmail(d: IntroEmailData): Message {
  const t = details([
    ["Referrer", `${d.referrerName} <${d.referrerEmail}>`],
    ["Introduced", `${d.referredName} <${d.referredEmail}>`],
    ["Their company", d.referredCompany],
    ["Interested in", d.interest],
    ["Message", d.message],
    ["Campaign", d.campaignName],
  ]);
  return {
    subject: `New introduction from ${d.referrerName}`,
    text: `A new referral introduction was submitted. The referrer confirmed they have permission to share these details.\n\n${t.text}`,
    html: wrap(d.company, {
      eyebrow: "New introduction",
      title: `${d.referrerName} introduced ${d.referredName}`,
      subtitle: "The referrer confirmed they have permission to share these details.",
      preheader: `Interested in: ${d.interest}`.slice(0, 110),
      bodyHtml: t.html,
    }),
  };
}

export function introReferrerEmail(d: { company: string; referrerName: string; referredName: string }): Message {
  const first = d.referrerName.split(" ")[0] ?? d.referrerName;
  return {
    subject: `Your introduction to ${d.company}`,
    text: `Hi ${first},\n\nThanks for introducing ${d.referredName}. We've recorded your introduction and our team will review it.\n\nIf you didn't submit this, please ignore this message.`,
    html: wrap(d.company, {
      eyebrow: "Introduction recorded",
      title: `Thanks for the introduction, ${first}`,
      preheader: `We've recorded your introduction of ${d.referredName}.`,
      bodyHtml: `<p style="margin:0">Thanks for introducing ${h(d.referredName)}. We've recorded your introduction and our team will review it.</p>${small("If you didn't submit this, please ignore this message.")}`,
    }),
  };
}
