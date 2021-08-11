<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "WasmBlob",
  props: ["id", "blob"],
  methods: {
    mouseenter(event: Event) {
      console.log("mouseenter", event)
    },
  }
});
</script>

<template @mouseenter="mouseenter">
  <div class="WasmBlob Box">

    <section>
      <label class="Blob icon-blob"></label>
      <div>
        <strong>{{ blob.name }}</strong>
        <div class="Separator" />
        <code>{{ blob.codeHash }}</code>
      </div>
    </section>

    <section>
      <label class="Schema icon-schema"></label>
      <div>
        <div class="Info">No schema loaded.</div>
        <div class="Separator" />
        <button>Provide schema...</button>
      </div>
    </section>

    <section>
      <label class="Upload icon-upload"></label>
      <div>
        <div class="Info">Not uploaded to any chains.</div>
        <div class="Separator" />
        <button>Look for matching code hashes...</button>
        <button>Upload to chain...</button>
      </div>
    </section>

    <section>
      <label class="Instance icon-instance"></label>
      <div>
        <div class="Info">No instances registered.</div>
        <div class="Separator" />
        <button>Import instance...</button>
        <button>Deploy instance...</button>
      </div>
    </section>

    <!--<header class="Header">
      <div class="Title">
      </div>
      <button class="Close icon-close" />
    </header>

    <section class="Content">
      <div class="InstancePicker">
        <img class="InstSearchIcon icon-filter" />
        <div class="InstSearch"><input type="text" placeholder="filter instances" /></div>
        <div class="InstList">instance list</div>
      </div>
      <div class="MethodPicker">
        <img class="InstIcon icon-instance" />
        <div class="InstTitle">
          <div><strong>inst label</strong><br>inst addr</div>
        </div>
        <div class="MethodList">instance method list</div>
      </div>
      <div class="Invocation">
        <div class="MethodIcon">q/tx</div>
        <div class="Method">method name</div>
        <div class="MethodArgs">method args</div>
        <button class="MethodRun icon-run" />
        <div class="MethodResult">method result</div>
      </div>
    </section>

    <div class="StatusBar"><strong>Helpful status bar&nbsp;</strong> instead of distracting tooltips</div>-->
  </div>
</template>

<style scoped lang="scss">
@import './box.scss'
</style>
