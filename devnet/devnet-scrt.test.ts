import { testDevnetPlatform } from './devnet-base.test'
import { Token } from '@fadroma/agent'
import { ScrtConnection } from '@fadroma/scrt'
import ScrtContainer from './devnet-scrt'
export default () => testDevnetPlatform(
  ScrtConnection, ScrtContainer, '1.9', 'secretd', new Token.Native('uscrt')
)
