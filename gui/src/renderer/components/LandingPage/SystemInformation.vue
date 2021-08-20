<template>
  <div>
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

<script>
import { exec } from 'child_process';

export default {
  data() {
    return {
      config: {
        chainId: null,
        indent: true,
        keyringBackend: null,
        node: null,
        output: null,
        trustNode: null,
      },
    };
  },
  mounted() {
    this.secretConfig();
  },
  methods: {
    secretConfig() {
      exec('secretcli config', (error, data, getter) => {
        if (error) {
          console.log('error', error.message);
          return;
        }
        if (getter) {
          console.log('data', data);
          return;
        }

        const processResult = (stdout) => {
          const lines = stdout.toString().split('\n');
          const results = [];
          lines.forEach((line) => {
            const parts = line
              .split('=')
              .map((x) => x.replace(/\s/g, '').replace(/"/g, ''));
            if (parts[0].length > 0) {
              results[parts[0]] = parts[1];
            }
          });
          return {
            chainId: results['chain-id'],
            indent: results.indent,
            keyringBackend: results['keyring-backend'],
            node: results.node,
            output: results.output,
            trustNode: results['trust-node'],
          };
        };

        this.config = processResult(data);
      });
    },
  },
};
</script>

<style scoped>
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
