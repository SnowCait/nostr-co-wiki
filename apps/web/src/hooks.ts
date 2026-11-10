import type { Reroute } from "@sveltejs/kit/hooks";
export const reroute: Reroute = async ({ url, fetch }) => {
  if (url.pathname === "/api/admin-hostname") {
    return;
  }
  const hostname: string = await (await fetch("/api/admin-hostname")).json();
  if (hostname && url.hostname === hostname) {
    return "/admin" + (url.pathname === "/" ? "" : url.pathname);
  }
};
