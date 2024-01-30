import * as PlatformBase from '../devnet-platform-base'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as CW from '@fadroma/cw'
import { Chain, Token } from '@fadroma/agent'

export type Version = `1.12.9-testnet`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '1.12.9-testnet': version(
    '1.12.9-testnet',
    'public.ecr.aws/l9h3g6c6/injective-core:v1.12.9-testnet',
    '6af75fe970423dfa5b3df9a2023181dba95a86bc3d718eb7abab09d8ed8ff417'
  ),
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'injective'
  const image = PlatformBase.debianDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   CW.Injective.Connection as { new (...args: unknown[]): Chain.Connection },
    Identity:     CW.Injective.MnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uarch'),
    nodeBinary:   'injectived',
    bech32Prefix: 'inj',
    nodePortMode: 'rpc' as APIMode,
    waitString:   'indexed block',
    container:    { image }
  }
}
