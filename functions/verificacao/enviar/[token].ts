import { validateAccessToken } from "../../../src/lib/verificacao-anuncio/intake.mjs";

export const onRequestGet = async ({ request }: { request: Request }) => {
  const requestUrl = new URL(request.url);
  const rawToken = decodeURIComponent(requestUrl.pathname.split("/").filter(Boolean).at(-1) || "");

  try {
    const token = validateAccessToken(rawToken);
    const destination = new URL("/verificacao/enviar/", requestUrl.origin);
    destination.searchParams.set("t", token);
    return Response.redirect(destination, 302);
  } catch {
    return new Response("Página não encontrada", {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
