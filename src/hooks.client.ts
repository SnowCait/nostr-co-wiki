import {
  baseLocale,
  isLocale,
  overwriteGetLocale,
} from "#lib/paraglide/runtime.js";

// Hydrate the locale chosen for this document, including Accept-Language on SSR.
overwriteGetLocale(() => {
  const locale = document.documentElement.lang;
  return isLocale(locale) ? locale : baseLocale;
});
