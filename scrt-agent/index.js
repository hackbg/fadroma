import SecretNetworkAgent from './agent.js'
import SecretNetworkContract from './contract.js'
import SecretNetwork from './network.js'
//import { loadSchemas } from '@fadroma/utilites/schema.js'

export {
  SecretNetwork,
  SecretNetworkAgent,
  SecretNetworkContract,
  //loadSchemas
}

/**@typedef {Object} Connection
 * @property {SecretNetworkNode} [node] - (if localnet) interface to docker container
 * @property {SecretNetwork} network - interface to the node's REST API endpoint.
 * @property {SecretNetworkAgent} agent - a default agent to query and transact on that network.
 * @property {SecretNetworkBuilder} builder - can upload contracts to that network as that agent.
 */
