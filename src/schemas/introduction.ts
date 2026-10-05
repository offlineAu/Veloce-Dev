import { z } from "zod";
import { emailField, guardFields, optionalText, refToken, text } from "./common";

export const PROJECT_INTERESTS = [
  ["NEW_WEBSITE", "A new website"],
  ["REDESIGN", "A redesign of their current site"],
  ["FEATURE_OR_INTEGRATION", "A specific feature or integration"],
  ["UNSURE", "Not sure yet"],
] as const;

const introductionShape = {
    referrerName: text(100, "Please add your name."),
    referrerEmail: emailField,
    referredName: text(100, "Who are you introducing?"),
    referredEmail: emailField,
    referredCompany: optionalText(120),
    projectInterest: z.enum(
      PROJECT_INTERESTS.map((t) => t[0]) as [
        (typeof PROJECT_INTERESTS)[number][0],
        ...(typeof PROJECT_INTERESTS)[number][0][],
      ],
      { error: "Pick the closest option." },
    ),
    message: optionalText(1000, true),
    referrerConsent: z.literal(true, { error: "Please confirm you have permission to share their details." }),
    refToken,
    /** Honeypot: real users never fill this. */
    contactFax: z.string().max(200).optional(),
};

const differentPeople = (v: { referrerEmail: string; referredEmail: string }) => v.referrerEmail !== v.referredEmail;
const sameEmail = { path: ["referredEmail"], message: "Use the other person's email, not your own." };

/** Full server-side schema. */
export const introductionSchema = z.object({ ...introductionShape, ...guardFields }).refine(differentPeople, sameEmail);
/** Browser-side schema without the hidden guard fields. */
export const introductionClientSchema = z.object(introductionShape).refine(differentPeople, sameEmail);
export type IntroductionFormValues = z.input<typeof introductionClientSchema>;

export type IntroductionInput = z.input<typeof introductionSchema>;
export type IntroductionData = z.output<typeof introductionSchema>;
