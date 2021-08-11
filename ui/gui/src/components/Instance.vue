<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "Networks",
  props: ["id", "blob"],
  methods: {
    mouseenter(event: Event) {
      console.log("mouseenter", event)
    },
  }
});
</script>

<template @mouseenter="mouseenter">
  <div class="Instance Box">

    <section>
      <label class="icon-instance"></label>
      <div>
        <strong>Instance</strong>
        <div class="Separator" />
        <div class="Actions">
          <code>secret1n5xe4hs4xuk6fkatkpqpgpzcqrhwcx29hlkpjd</code>
          on
          <code>holodeck-2</code>
          <button>History...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="icon-storage"></label>
      <div>
        <div>0 KV pairs in storage</div>
        <div class="Separator" />
        <div class="Actions">
          <button>Browse storage...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="logogram">Q</label>
      <div>
        <div>No queries available</div>
        <div class="Separator" />
        <div class="Actions">
          <button>Submit query...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="logogram">TX</label>
      <div>
        <div>No transactions available</div>
        <div class="Separator" />
        <div class="Actions">
          <button>Submit transaction...</button>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped lang="scss">
@import './box.scss';
.Networks code { margin-left: 1em; }
</style>
