import { defineI18n } from "sveltekit-i18n/kit";
import type { Config } from "sveltekit-i18n";
export const config = {
  initLocale: "en",
  fallbackLocale: "en",
  loaders: [
    {
      locale: ["en", "ja"],
      namespace: "common",
      loader: async ({ locale }) =>
        (await import(`./translations/${locale}/common.json`)).default,
    },
  ],
} satisfies Config;
export const { handle, load, use, get } = defineI18n(config, {
  preferredLocale: (event) => event.cookies?.get("lang"),
});

export type NoticeKey = {
  [K in keyof TranslationSchema]: TranslationSchema[K] extends never
    ? K
    : never;
}[keyof TranslationSchema];
