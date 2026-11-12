<script lang="ts">
  import { get } from "#lib/i18n.ts";
  import { saveLanguageCookie } from "#lib/language-cookie.ts";
  const i18n = get();
  async function change(event: Event) {
    const locale = (event.currentTarget as HTMLSelectElement).value;
    saveLanguageCookie(locale);
    await i18n.setLocale(locale);
  }
</script>

<label for="language">{i18n.t("common.language")}</label>
<select id="language" value={i18n.locale} onchange={change}>
  <option value="en">English</option><option value="ja">日本語</option>
</select>
