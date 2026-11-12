import { load as loadI18n } from "#lib/i18n.ts";
export async function load(event: import("./$types").LayoutServerLoadEvent) {
  const { route } = event;
  return {
    ...(await loadI18n(event)),
    administration: route.id === "/admin" || route.id?.startsWith("/admin/"),
  };
}
