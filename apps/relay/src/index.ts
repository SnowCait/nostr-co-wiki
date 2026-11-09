import { DurableObject } from "cloudflare:workers";

export class Wiki extends DurableObject<Cloudflare.Env> {
  fetch(): Response {
    return new Response("Not Found", { status: 404 });
  }
}

export default {
  fetch(): Response {
    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Cloudflare.Env>;
