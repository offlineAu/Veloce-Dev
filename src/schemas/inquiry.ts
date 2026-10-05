import { z } from "zod";
import { emailField, guardFields, optionalText, optionalWebsite, refToken, text } from "./common";

export const PROJECT_TYPES = [
  ["NEW_PROJECT", "New project"],
  ["REDESIGN", "Website redesign"],
  ["ECOMMERCE", "E-commerce"],
  ["CUSTOM_WEB_APP", "Custom web application"],
  ["INTEGRATION", "Integration"],
  ["MAINTENANCE", "Maintenance"],
  ["OTHER", "Other"],
] as const;

/** Advice topics mapped to the lead's existing project categories. */
export const CONSULTATION_TOPICS = [
  ["NEW_PROJECT", "Planning an idea"],
  ["REDESIGN", "Reviewing an existing website"],
  ["INTEGRATION", "Improving a business workflow"],
  ["OTHER", "Choosing the right approach"],
] as const;

export const WEBSITE_TYPES = [
  ["BUSINESS", "Business website"],
  ["CORPORATE", "Corporate website"],
  ["ECOMMERCE_STORE", "E-commerce store"],
  ["WEB_APP", "Web application"],
  ["LANDING_PAGE", "Landing page"],
  ["OTHER", "Other"],
] as const;

/** Project types for which the "website type" question is useful. */
export const WEBSITE_TYPE_PROJECTS: readonly string[] = ["NEW_PROJECT", "REDESIGN"];

type Values<T extends readonly (readonly [string, string])[]> = [T[number][0], ...T[number][0][]];

const inquiryShape = {
  name: text(100, "Please add your name."),
  email: emailField,
  companyName: optionalText(120),
  currentWebsite: optionalWebsite,
  projectType: z.enum(PROJECT_TYPES.map((t) => t[0]) as Values<typeof PROJECT_TYPES>, {
    error: "Pick the closest project type.",
  }),
  websiteType: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(WEBSITE_TYPES.map((t) => t[0]) as Values<typeof WEBSITE_TYPES>).optional(),
  ),
  /** Service card the visitor asked about, when the inquiry was opened from one. */
  serviceSlug: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
  projectGoals: text(1000, "A sentence is enough."),
  additionalDetails: optionalText(2000, true),
  intent: z.enum(["CONVERSATION", "CONSULTATION"]).default("CONVERSATION"),
  referralClaimed: z.boolean().default(false),
  privacyConsent: z.literal(true, { error: "Please confirm you agree to the privacy notice." }),
  refToken,
  landingPath: optionalText(200),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(100),
  /** Honeypot: real users never fill this. */
  contactFax: z.string().max(200).optional(),
};

/** Full server-side schema. */
export const inquirySchema = z.object({ ...inquiryShape, ...guardFields });
/** Browser-side schema: guard fields are added at submit time, not entered by the user. */
export const inquiryClientSchema = z.object(inquiryShape);
export type InquiryFormValues = z.input<typeof inquiryClientSchema>;

export type InquiryInput = z.input<typeof inquirySchema>;
export type InquiryData = z.output<typeof inquirySchema>;
