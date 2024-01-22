import OKP4Container from './okp4-devnet'
import { testDevnetPlatform } from '../devnet-base.test'
import { Token } from '@fadroma/agent'
import { OKP4Connection } from '@fadroma/cw'
export default () => testDevnetPlatform(
  OKP4Connection, OKP4Container, '5.0', 'okp4d', new Token.Native('uknow')
)
