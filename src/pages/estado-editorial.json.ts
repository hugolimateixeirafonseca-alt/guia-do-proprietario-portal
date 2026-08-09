import type { APIRoute } from "astro";
import feed from "../data/editorial-feed.json";

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(feed, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};
