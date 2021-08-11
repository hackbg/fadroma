<script lang="ts">
import "../icons/style.scss"
import { defineComponent } from "vue";
import SystemInfo from "@/components/SystemInfo.vue";
import WasmBlob from "@/components/WasmBlob.vue";
import Networks from "@/components/Networks.vue";
import Instance from "@/components/Instance.vue";
import { State } from "../types";

export default defineComponent({
  name: "Home",
  components: {
    //SystemInfo,
    WasmBlob,
    Networks,
    Instance,
  },
  data(): State {
    return {
      blobs: {
        0: {
          name: "/path/to/MyCodeBlob.wasm",
          codeHash:
            "7536621f5ba32eeddde858143acd6d993e9e36b98df4588df58ae718891090a6",
          instances: [],
          schema: {
            init: {},
            handle: {},
            query: {},
          },
        },
      },
    };
  },
  methods: {
    dragover(event: Event) {
      event.preventDefault();
    },
    dragleave(event: Event) {
      return event
    },
    drop(event: DragEvent) {
      console.log("drop", event);
      event.preventDefault();
      event.stopPropagation();
      for (const file of event.dataTransfer?.files||[]) {
        if (file && file.name.endsWith('.wasm')) {
          console.log('data:',this.$data)
          this.$data.blobs[1] = {
            name: file.name,
            codeHash: "no_code_hash",
            instances: [],
            schema: {
              init: {},
              handle: {},
              query: {},
            },
          };
        }
        /*if (f.endsWith('.wasm'))
        // Using the path attribute to get absolute file path
        console.log('File Path of dragged files: ', f.path)*/
      }
    },
  },
});
</script>

<template>
  <div
    class="Home View DropZone"
    @dragover="dragover"
    @dragleave="dragleave"
    @drop="drop"
  >
    <h1>Fadroma</h1>
    <Networks class="Panel1" />
    <!--<SystemInfo class="Panel2" />-->
    <WasmBlob
      v-for="[id, blob] of Object.entries(blobs)"
      :key="id"
      :id="id"
      :blob="blob"
    />
    <Instance />
  </div>
</template>

<style lang="scss">
@import '../components/box.scss';
h1 {
  color: rgba(255,255,255,0.9);
  text-transform: uppercase;
  font-size: 2rem;
  letter-spacing: 0.25em;
  font-weight: normal;
  margin-bottom: 1rem;
}
</style>
