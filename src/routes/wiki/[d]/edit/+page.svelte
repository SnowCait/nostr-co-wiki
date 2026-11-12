<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head
  ><title>{m.edit_title({ title: data.title })} — NostrCoWiki</title
  ></svelte:head
>
<h1>{data.title}</h1>
<ArticleNav d={data.d} current="edit" />
<h2>{m.edit_article()}</h2>
{#key data.d + (data.restored ?? "")}<Editor {data} />{/key}
