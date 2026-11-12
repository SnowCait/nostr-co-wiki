<script lang="ts">
  import { get } from "#lib/i18n.ts";
  const i18n = get();
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title>{i18n.t("common.create_article_nostrcowiki")}</title></svelte:head
>
<h1>{i18n.t("common.create_article")}</h1>
<Editor {data} />
