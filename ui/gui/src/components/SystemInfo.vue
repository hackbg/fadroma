<template>
  <div class="SystemInfo Box">
    <div class="title">SecretCLI Config</div>
    <div class="items">
      <div class="item">
        <div class="name">Chain Id:</div>
        <div class="value">{{ config.chainId }}</div>
      </div>
      <div class="item">
        <div class="name">Indent:</div>
        <div class="value">{{ config.indent }}</div>
      </div>
      <div class="item">
        <div class="name">Keyring Backend:</div>
        <div class="value">{{ config.keyringBackend }}</div>
      </div>
      <div class="item">
        <div class="name">Node:</div>
        <div class="value">{{ config.node }}</div>
      </div>
      <div class="item">
        <div class="name">Output:</div>
        <div class="value">{{ config.output }}</div>
      </div>
      <div class="item">
        <div class="name">Trust node:</div>
        <div class="value">{{ config.trustNode }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import * as child from "child_process";

type SecretConfig = {
  chainId?: string;
  indent?: boolean;
  keyringBackend?: string;
  node?: string;
  output?: string;
  trustNode?: string;
};

export default defineComponent({
  name: "SystemInfo",
  data(): { [key: string]: SecretConfig } {
    return {
      config: {
        chainId: undefined,
        indent: undefined,
        keyringBackend: undefined,
        node: undefined,
        output: undefined,
        trustNode: undefined,
      },
    };
  },
  mounted() {
    this.secretConfig();
  },
  methods: {
    secretConfig() {
      child.exec("secretcli config", (error, data, getter) => {
        if (error) {
          console.log("error", error.message);
          return;
        }
        if (getter) {
          console.log("data", data);
          return;
        }
        const processResult = (stdout: string) => {
          const lines = stdout.toString().split("\n");
          const results: { [key: string]: string } = {};
          lines.forEach((line) => {
            const parts = line
              .split("=")
              .map((x) => x.replace(/\s/g, "").replace(/"/g, ""));
            if (parts[0].length > 0) {
              const key: string = parts[0];
              results[key] = parts[1];
            }
          });
          return {
            chainId: results["chain-id"],
            indent:
              results.indent === "true"
                ? true
                : results.indent === "false"
                ? false
                : undefined,
            keyringBackend: results["keyring-backend"],
            node: results.node,
            output: results.output,
            trustNode: results["trust-node"],
          };
        };
        this.config = processResult(data);
      });
    },
  },
});
</script>

<style scoped lang="scss">
@import '../components/box.scss';
.title {
  color: #888;
  font-size: 18px;
  font-weight: initial;
  letter-spacing: 0.25px;
  margin-top: 10px;
}
.items {
  margin-top: 8px;
}
.item {
  display: flex;
  margin-bottom: 6px;
}
.item .name {
  color: #6a6a6a;
  margin-right: 6px;
}
.item .value {
  color: #35495e;
  font-weight: bold;
}
</style>
