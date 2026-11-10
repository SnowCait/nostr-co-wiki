export { Wiki } from "./wiki";

export default {
  fetch(request, env): Response | Promise<Response> {
    if (
      new URL(request.url).pathname !== "/" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not Found", { status: 404 });
    }
    return env.WIKI.getByName("wiki").fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
