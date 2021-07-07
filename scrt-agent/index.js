import Scrt from './network.js'
import SecretNetworkAgent from './agent.js'
import SecretCLIAgent from './agent-secretcli.js'
import SecretNetworkContract from './contract.js'
import SecretNetworkContractWithSchema from './contractWithSchema.js'
import SchemaWrapper from './Wrapper.js'

export {
  Scrt, Scrt as SecretNetwork,
  SecretNetworkAgent, SecretCLIAgent,
  SecretNetworkContract, SchemaWrapper, SecretNetworkContractWithSchema,
}

/**@typedef {Object} Connection
 * @property {SecretNetworkNode} [node] - (if localnet) interface to docker container
 * @property {SecretNetwork} network - interface to the node's REST API endpoint.
 * @property {SecretNetworkAgent} agent - a default agent to query and transact on that network.
 * @property {SecretNetworkBuilder} builder - can upload contracts to that network as that agent.
 */
