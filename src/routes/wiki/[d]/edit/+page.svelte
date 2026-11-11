<script lang="ts">
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>Edit {data.title} — NostrCoWiki</title></svelte:head>
<p class="eyebrow">Contribute to the encyclopedia</p>
<h1>Edit {data.title}</h1>
<ArticleNav d={data.d} current="edit" />
{#key data.d + (data.restored ?? "")}<Editor {data} />{/key}
