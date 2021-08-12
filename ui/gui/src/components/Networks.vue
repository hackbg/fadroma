<script lang="ts">
import { defineComponent } from "vue";
import Collapsible from '@/components/Collapsible.vue';
export default defineComponent({
  name: "Networks",
  props: ["id", "blob"],
  components: { Collapsible },
  methods: {
    mouseenter(event: Event) {
      console.log("mouseenter", event)
    },
  }
});
</script>

<template @mouseenter="mouseenter">

  <Collapsible class="Networks">

    <template v-slot:header>
      <label class="icon-chain"></label>
      <h2>Networks</h2>
    </template>

    <template v-slot:body>

      <section>
        <label></label>
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
        <label></label>
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
        <label></label>
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
        <label></label>
        <div>
          <div>Secret Network Mocknet</div>
          <div class="Separator" />
          <div class="Actions">
            <button>Configure...</button>
          </div>
        </div>
      </section>
    </template>

  </Collapsible>

</template>

<style lang="sass">
.Networks code { margin-left: 1em; }
</style>
