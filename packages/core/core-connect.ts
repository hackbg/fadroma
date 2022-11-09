import { ClientError, ClientConsole } from './core-events'
import { into, validated }            from './core-fields'
import { codeHashOf }                 from './core-code'
import { ContractInstance }           from './core-contract-instance'
import type { Into, Class }              from './core-fields'
import type { Uint128 }                  from './core-math'
import type { CodeId, CodeHash, Hashed } from './core-code'
import type { ContractTemplate }         from './core-contract-template'
import type { Name }                     from './core-labels'

Chain.Agent = Agent as AgentClass<Agent>

Agent.Bundle = Bundle as unknown as BundleClass<Bundle>

export interface ContractDeployer<C> extends PromiseLike<C> {
  /** The group of contracts that contract belongs to. */
  context?: Deployment
  /** The agent that will upload and instantiate this contract. */
  agent?:   Agent
}
