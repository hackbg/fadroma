import { Console, bold } from '@fadroma/ops'
import { Chain, Mocks } from '@fadroma/ops'
import Scrt_1_2 from '@fadroma/scrt-1.2'
import { Fadroma } from '@fadroma/cli'

// Reexport the main libraries
export * from '@fadroma/cli'
export * from '@fadroma/ops'
export * from '@fadroma/scrt'
export * from '@fadroma/snip20'

// Logging interface - got one of these in each module.
// Based on @hackbg/konzola, reexported through @fadroma/ops.
const console = Console('@hackbg/fadroma')

// The namedChains are functions keyed by chain id,
// which give you the appropriate Chain and Agent
// for talking to that chain id.
export { Scrt_1_2 }
Object.assign(Chain.namedChains, {
  'Scrt_1_2_Mainnet': Scrt_1_2.chains.Mainnet,
  'Scrt_1_2_Testnet': Scrt_1_2.chains.Testnet,
  'Scrt_1_2_Devnet':  Scrt_1_2.chains.Devnet,
  'Mocknet': () => {
    console.warn(bold('HELP WANTED:'), 'The Mocknet is far from implemented.')
    return Mocks.Chains.Mocknet()
  },
})

// Default export is an interface to @fadroma/cli,
// a command runner based on @hackbg/komandi.
export default new Fadroma()
