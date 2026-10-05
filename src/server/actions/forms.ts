"use server";

import { clientKey } from "@/server/security/request";
import { submitInquiry } from "@/server/services/lead";
import { submitIntroduction, type IntroductionResult } from "@/server/services/introduction";
import type { ActionResult } from "@/server/services/result";

export async function submitInquiryAction(input: unknown): Promise<ActionResult> {
  return submitInquiry(input, { clientKey: await clientKey() });
}

export async function submitIntroductionAction(input: unknown): Promise<IntroductionResult> {
  return submitIntroduction(input, { clientKey: await clientKey() });
}
