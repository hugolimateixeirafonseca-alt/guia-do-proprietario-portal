import { handleVerificationIntake } from "./intake";
import type { RequestContext } from "../../lib/verificacao-anuncio";

export const onRequestPost = (context: RequestContext) =>
  handleVerificationIntake(context, { requireMarketingConsent: true });
