import say, { sayer, muted } from './say.js'
import { loadJSON, loadSchemas } from './schema.js'

import SecretNetworkAgent from './agent.js'
import SecretNetworkBuilder from './builder.js'
import SecretNetworkContract from './contract.js'
import Gas from './gas.js'

export {
  say,
  sayer,
  muted,
  loadJSON,
  loadSchemas
}

export const SecretNetwork = {
  Agent:    SecretNetworkAgent,
  Builder:  SecretNetworkBuilder,
  Contract: SecretNetworkContract,
  Gas
}
