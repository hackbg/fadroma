<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "Collapsible",
  data() {
    return {
      expanded: false,
    }
  },
  methods: {
    toggle() {
      this.expanded = !this.expanded
    },
  }
});
</script>

<template>
  <div class="Collapsible Box">
    <header>
      <div>
        <slot name="header" />
      </div>
      <button class="icon-circle-right" @click="toggle" />
    </header>
    <template v-if="expanded">
      <hr class="Expanded">
      <slot name="body" />
    </template>
  </div>
</template>

<style lang="scss">
.Collapsible {
  display: flex;
  flex-flow: column nowrap;

  hr.Expanded {
    margin-top: 0.5rem;
  }

  & > header {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    & > div {
      flex-grow: 1;
      margin-right: 1rem;
      display: flex;
      flex-flow: row nowrap;
      align-items: center;
      h2,
      label {
        margin: 0 0 0 1rem;
      }
    }
    & > button {
      border-radius: 0.4rem;
      width: 3rem;
      height: 3rem;
      font-size: 1.5em;
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      border-top:  1px solid rgba(255,255,255,0.25);
      border-left: 1px solid rgba(255,255,255,0.25);
      box-shadow:  0.25em 0.25em 0.5em rgba(0,0,0,0.25);
    }
  }
}
</style>
