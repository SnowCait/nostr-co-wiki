<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  async function change(event: Event) {
    const locale = (event.currentTarget as HTMLSelectElement).value;
    document.cookie = `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await i18n.setLocale(locale);
  }
</script>

<label for="language">{i18n.t("common.language")}</label>
<select id="language" value={i18n.locale} onchange={change}>
  <option value="en">English</option><option value="ja">日本語</option>
</select>
