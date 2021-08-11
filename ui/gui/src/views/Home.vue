<template>
  <div
    class="Home View DropZone"
    @dragover="dragover"
    @dragleave="dragleave"
    @drop="drop"
  >
    <SystemInfo />
    <WasmBlob
      v-for="[id, blob] of Object.entries(blobs)"
      :key="id"
      :id="id"
      :blob="blob"
    />
  </div>
</template>

<script lang="ts">
import "../icons/style.scss"
import { defineComponent } from "vue";
import SystemInfo from "@/components/SystemInfo.vue";
import WasmBlob from "@/components/WasmBlob.vue";
import { State } from "../types";

export default defineComponent({
  name: "Home",
  components: {
    SystemInfo,
    WasmBlob,
  },
  data(): State {
    return {
      blobs: { 0: {
            name: "filename",
            codeHash: "no_code_hash",
            instances: [],
            schema: {
              init: {},
              handle: {},
              query: {},
            },
          }},
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
