import { searchArticles } from "#lib/server/wiki.ts";
export async function load({
  url,
  request,
}: import("./$types").PageServerLoadEvent) {
  const q = url.searchParams.get("q")?.trim() ?? "";
  try {
    return {
      q,
      articles: q ? await searchArticles(request, q) : [],
      failure: "",
    };
  } catch {
    return {
      q,
      articles: [],
      failure: "Search is unavailable. Please try again.",
    };
  }
}
