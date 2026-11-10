export { Wiki } from "./wiki";

export default {
  async fetch(request, env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/admin/")) {
      const response =
        request.method === "OPTIONS"
          ? new Response(null, { status: 204 })
          : await env.WIKI.getByName("wiki").fetch(request);
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    }
    if (
      new URL(request.url).pathname !== "/" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not Found", { status: 404 });
    }
    return env.WIKI.getByName("wiki").fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
