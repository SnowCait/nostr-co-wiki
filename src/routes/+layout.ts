import { load as loadI18n } from "#lib/i18n.ts";
export const load: import("./$types").LayoutLoad = async (event) => ({
  ...event.data,
  ...(await loadI18n(event)),
});
