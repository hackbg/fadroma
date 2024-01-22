import { testDevnetPlatform } from '../devnet-base.test'
import ScrtContainer from './scrt-devnet'
import { Token } from '@fadroma/agent'
import { ScrtConnection } from '@fadroma/scrt'
export default () => testDevnetPlatform(
  ScrtConnection, ScrtContainer, '1.9', 'secretd', new Token.Native('uscrt')
)
