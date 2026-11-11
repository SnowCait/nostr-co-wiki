import { publicArticle, relayUrl } from "#lib/server/wiki.ts";
import { renderArticle } from "#lib/server/render.ts";
export async function load({
  params,
  url,
}: import("./$types").PageServerLoadEvent) {
  const article = await publicArticle(params.d);
  return {
    article,
    html: renderArticle(article.content),
    relayUrl: relayUrl(url),
  };
}
