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
      <label class="icon-git"></label>
      <div>
        <strong>git@github.com:hackbg/sienna.git</strong>
        <div class="Separator" />
        <code>0c6401afecd518dc5221b7679c2795ee031e3193</code>
      </div>
    </section>

    <section>
      <label class="icon-folder"></label>
      <div>
        <div>
          <strong>contracts/snip20-sienna</strong>
        </div>
        <div class="Separator" />
        <div class="Actions">
          <button>Browse...</button>
          <button>Dependencies...</button>
          <button>Build...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="icon-checkmark"></label>
      <div>
        <div>
          All <strong>10</strong> unit tests passed,
          achieving <strong>99.9%</strong> coverage.
        </div>
        <div class="Separator" />
        <div class="Actions">
          <button>Run unit tests...</button>
          <button>View report...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="icon-blob"></label>
      <div>
        <div>
          <strong>{{ blob.name }}</strong>
          <br>
          (12345 bytes raw, 2345 bytes compressed)
        </div>
        <div class="Separator" />
        <code>
          {{ blob.codeHash.slice(0, Math.floor(blob.codeHash.length/2)) }}
          <br>
          {{ blob.codeHash.slice(Math.floor(blob.codeHash.length/2)) }}
        </code>
      </div>
    </section>

    <section>
      <label class="icon-warning"></label>
      <div>
        <div>
          <strong>2</strong> integration tests failed,
          <strong>15</strong> passed.
        </div>
        <div class="Separator" />
        <div class="Actions">
          <button>Run integration tests...</button>
          <button>View report...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="icon-schema"></label>
      <div>
        <div class="Info">No schema provided.</div>
        <div class="Separator" />
        <button>Export schema...</button>
        <button>Import schema...</button>
      </div>
    </section>

    <section>
      <label class="icon-upload"></label>
      <div>
        <div class="Info">No known uploads.</div>
        <div class="Separator" />
        <button>Look for matching code hashes...</button>
        <button>Upload to chain...</button>
      </div>
    </section>

    <section>
      <label class="icon-instance"></label>
      <div>
        <div class="Info">No known instances.</div>
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
