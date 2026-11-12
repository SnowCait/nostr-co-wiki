<script lang="ts">
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>Create article — NostrCoWiki</title></svelte:head>
<p class="eyebrow">Contribute to the encyclopedia</p>
<h1>Create article</h1>
<Editor {data} />
