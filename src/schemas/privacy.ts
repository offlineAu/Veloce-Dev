import { z } from "@/lib/security/schema";
import { PRIVACY_NOTICE_VERSION } from "@/lib/legal";

export const privacyReceiptFields = {
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION, {
    error: "The privacy notice has changed. Refresh this page and review it before submitting again.",
  }),
};
