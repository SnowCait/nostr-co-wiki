<script lang="ts">
  import ArticleNav from "#lib/components/ArticleNav.svelte";
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>Edit {data.title} — NostrCoWiki</title></svelte:head>
<h1>{data.title}</h1>
<ArticleNav d={data.d} current="edit" />
<h2>Edit article</h2>
{#key data.d + (data.restored ?? "")}<Editor {data} />{/key}
