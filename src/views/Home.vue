<template>
  <div class="home">
    <SystemInfo />
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SystemInfo from "@/components/SystemInfo.vue";

export default defineComponent({
  name: "Home",
  components: {
    SystemInfo,
  },
});
</script>
