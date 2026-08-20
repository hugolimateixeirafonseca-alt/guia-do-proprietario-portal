import {
  PublicError,
  clearSessionCookie,
  json,
  requireConfiguration,
  resolveSession,
  safeErrorResponse,
  type RequestContext
} from "../../lib/kit-estudante";

export const onRequestGet = async ({ request, env }: RequestContext) => {
  try {
    const config = requireConfiguration(env);
    await resolveSession(request, config.db, config.sessionSecret);
    return json({ active: true });
  } catch (error) {
    if (error instanceof PublicError) {
      return json({ active: false }, 200, { "Set-Cookie": clearSessionCookie() });
    }
    return safeErrorResponse(error);
  }
};

