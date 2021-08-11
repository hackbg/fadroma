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
      <label></label>
      <div>
        <strong>Networks</strong>
      </div>
    </section>

    <section>
      <label class="Chain icon-chain"></label>
      <div>
        <div>Secret Network Mainnet</div>
        <code>secret-2</code>
        <div class="Separator" />
        <div class="Actions">
          <button>Explore...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="Chain icon-chain"></label>
      <div>
        <div>Secret Network Testnet</div>
        <code>holodeck-2</code>
        <div class="Separator" />
        <div class="Actions">
          <button>Explore...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="Chain icon-chain"></label>
      <div>
        <div>Secret Network Localnet</div>
        <code>enigma-pub-mpc-3</code>
        <div class="Separator" />
        <div class="Actions">
          <button>Start</button>
          <button>View logs...</button>
          <button>Explore...</button>
        </div>
      </div>
    </section>

    <section>
      <label class="Chain icon-chain"></label>
      <div>
        <div>Secret Network Mocknet</div>
        <div class="Separator" />
        <div class="Actions">
          <button>Configure...</button>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped lang="scss">
@import './box.scss';
.Networks code { margin-left: 1em; }
</style>
