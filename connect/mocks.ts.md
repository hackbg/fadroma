## Mocks of native chain APIs

This specification only tests whether the Fadroma packages
wrap the underlying chain APIs correctly. The underlying methods
are mocked out below.

```typescript
function mockChainApi (chain, ...agents) {
  if (chain instanceof ScrtGrpc) return mockScrtGrpcApi(chain, ...agents)
  if (chain instanceof ScrtAmino) return mockScrtAminoApi(chain, ...agents)
}
```

### Mock of SecretJS gRPC

```typescript
function mockScrtGrpcApi (chain, ...agents) {
  const balances = {}
  chain.SecretJS = {
    SecretNetworkClient: class MockSecretNetworkClient {
      static create = () => new this()
      query = {
        auth: {
          account: async () => ({})
        },
        bank: {
          async balance ({ address, denom }) {
            const amount = balances[address]
            return {balance:{amount}}
          }
        },
        tendermint: {
          getLatestBlock: async () => ({block:{header:{height:+new Date()}}})
        },
        compute: {
          codeHash: async () => ({}),
          queryContract: async () => ({})
        }
      }
      tx = {
        bank: {
          async send ({ fromAddress, toAddress, amount }) {
            balances[fromAddress] = String(Number(balances[fromAddress]) - Number(amount))
            balances[toAddress]   = String(Number(balances[toAddress]) + Number(amount))
          }
        },
        compute: {
          async storeCode () { return {} },
          async instantiateContract () { return { arrayLog: [] } },
          async executeContract () { return { code: 0 } }
        }
      }
    },
    Wallet: class MockSecretNetworkWallet {
    }
  }
  for (const i in agents) {
    const agent = agents[i]
    agent.address ??= `agent${i}`
    agent.api = new chain.SecretJS.SecretNetworkClient()
    assert.equal(chain, agent.chain)
    balances[agent.address] = '1000'
  }
}
```

### Mock of SecretJS Amino

```typescript
function mockScrtAminoApi (chain, ...agents) {
  const balances = {}
  for (const {address} of agents) balances[address] = '1000'
  chain.API = class MockCosmWasmClient {
    async getBlock () {
      return { header: { height: +new Date() } }
    }
  }
  for (const i in agents) {
    const agent = agents[i]
    agent.address ??= `agent${i}`
    agent.API = class MockSigningCosmWasmClient {
      async getAccount (address) {
        return { balance: [ { amount: balances[address], denom: 'uscrt' } ] }
      }
      async getBlock () {
        return { header: { height: +new Date() } }
      }
      async sendTokens (toAddress, amount) {
        const fromAddress = agent.address
        balances[fromAddress] = String(Number(balances[fromAddress]) - Number(amount))
        balances[toAddress]   = String(Number(balances[toAddress]) + Number(amount))
      }
      async upload () { return {} }
      async instantiate () { return { logs: [ { events: [ { attributes: [null, null, null, null, {}] } ] } ] } }
      async queryContractSmart () { return {} }
      async execute () { return {} }
    }
  }
}
```

