/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'
import { Console, Error, bold } from '@fadroma/agent'
import type { Address, ChainId, Token } from '@fadroma/agent'

/** Environment settings for Secret Network. */
class ScrtConfig extends Config {
  /** The mainnet chain ID. */
  static defaultMainnetChainId: string = 'secret-4'
  /** The mainnet URL. */
  static defaultMainnetUrl: string = 'https://lcd.mainnet.secretsaturn.net'
  /** The testnet chain ID. */
  static defaultTestnetChainId: string = 'pulsar-3'
  /** The testnet URL. */
  static defaultTestnetUrl: string = 'https://api.pulsar3.scrttestnet.com/'

  constructor (
    options: Partial<ScrtConfig> = {},
    environment?: Environment
  ) {
    super(environment)
    this.override(options)
  }

  agentName: string|null = this.getString(
    'FADROMA_SCRT_AGENT_NAME', ()=>null)
  agentMnemonic: string|null = this.getString(
    'FADROMA_SCRT_AGENT_MNEMONIC', ()=>null)
  mainnetChainId: string = this.getString(
    'FADROMA_SCRT_MAINNET_CHAIN_ID', ()=>ScrtConfig.defaultMainnetChainId)
  testnetChainId: string = this.getString(
    'FADROMA_SCRT_TESTNET_CHAIN_ID', ()=>ScrtConfig.defaultTestnetChainId)
  mainnetUrl: string = this.getString(
    'FADROMA_SCRT_MAINNET_URL', ()=>ScrtConfig.defaultMainnetUrl)
  testnetUrl: string = this.getString(
    'FADROMA_SCRT_TESTNET_URL', ()=>ScrtConfig.defaultTestnetUrl)
}

class ScrtError extends Error {}

export {
  ScrtConfig as Config,
  ScrtError as Error,
  Console
}
