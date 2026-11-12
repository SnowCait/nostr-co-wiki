<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title
    >{i18n.t("common.edit_title", { title: data.title })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{data.title}</h1>
<ArticleNav d={data.d} current="edit" />
<h2>{i18n.t("common.edit_article")}</h2>
{#key data.d + (data.restored ?? "")}<Editor {data} />{/key}
