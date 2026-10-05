export const MAX_SHARE_TEXT = 1500;

export interface ShareMessageInput {
  companyName: string;
  link: string;
  offerTitle?: string | null;
}

export function buildShareMessage({ companyName, link, offerTitle }: ShareMessageInput): string {
  const offer = offerTitle?.trim() ? ` They're currently offering: ${offerTitle.trim()}.` : "";
  return [
    "Hi! I wanted to share something in case you or someone in your network is looking to turn an idea into working software, a website or a business system.",
    `${companyName} builds fast, practical websites and business systems around what each business actually needs.${offer}`,
    `If you're interested, take a look: ${link}`,
    "Feel free to message me if you'd like an introduction!",
  ].join("\n\n");
}

/** Link a recipient opens. Only the public token is exposed, never internal ids. */
export function buildProspectLink(siteUrl: string, token: string): string {
  const url = new URL("/", siteUrl);
  url.searchParams.set("ref", token);
  return url.toString();
}

export function mailtoHref(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, MAX_SHARE_TEXT))}`;
}

export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text.slice(0, MAX_SHARE_TEXT))}`;
}

/** Copies text; resolves true only if a copy method actually succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
