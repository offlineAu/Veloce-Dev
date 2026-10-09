import { z } from 'zod';
import { emailField, guardFields, optionalText, refToken, text } from './common';

const attribution = {
  refToken,
  utmSource: optionalText(100), utmMedium: optionalText(100), utmCampaign: optionalText(100),
};
export const meetingSessionSchema = z.object({
  ...attribution,
  entryPoint: z.enum(['workbench', 'contact']),
  context: optionalText(1000, true),
  privacyConsent: z.literal(true),
});
export const meetingVerificationSchema = z.object({
  reference: z.string().regex(/^[a-f0-9]{64}$/),
  accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  uid: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(),
});
export const meetingRequestClientSchema = z.object({
  name: text(100, 'Please add your name.'),
  email: emailField,
  context: optionalText(1000, true),
  privacyConsent: z.literal(true, { error: 'Please agree to the privacy notice.' }),
  contactFax: z.string().max(200).optional(),
});
export const meetingRequestSchema = meetingRequestClientSchema.extend({ ...guardFields, ...attribution });
