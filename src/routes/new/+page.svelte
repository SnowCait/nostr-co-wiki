<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import Editor from "#lib/components/Editor.svelte";
  let { data }: import("./$types").PageProps = $props();
</script>

<svelte:head><title>{m.create_article_nostrcowiki()}</title></svelte:head>
<h1>{m.create_article()}</h1>
<Editor {data} />
