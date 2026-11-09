export { Wiki } from "./wiki";

export default {
  fetch(request, env): Response | Promise<Response> {
    if (
      new URL(request.url).pathname !== "/" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not Found", { status: 404 });
    }
    const headers = new Headers(request.headers);
    headers.set("X-Wiki-IP", request.headers.get("CF-Connecting-IP") ?? "");
    return env.WIKI.getByName("wiki").fetch(new Request(request, { headers }));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
