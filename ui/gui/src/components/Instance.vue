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
  <div class="Networks Box">

    <section>
      <label class="icon-instance"></label>
      <div>
        <strong>Instance</strong>
        <div class="Separator" />
        <code>secret1n5xe4hs4xuk6fkatkpqpgpzcqrhwcx29hlkpjd</code>
      </div>
    </section>

    <section>
      <label class="icon-storage"></label>
      <div>
        <strong>0 KV pairs in storage</strong>
      </div>
    </section>

    <section>
      <label class="icon-storage"></label>
      <div>
        <strong>No queries available</strong>
      </div>
    </section>

    <section>
      <label class="icon-storage"></label>
      <div>
        <strong>No transactions available</strong>
      </div>
    </section>

  </div>
</template>

<style scoped lang="scss">
@import './box.scss';
.Networks code { margin-left: 1em; }
</style>
