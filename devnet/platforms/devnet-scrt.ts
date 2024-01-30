import * as PlatformBase from '../devnet-platform-base'
import { packageRoot } from '../package'
import type { APIMode } from '../devnet-base'
import type * as Platform from '../devnet-platform'
import * as OCI from '@fadroma/oci'
import * as Scrt from '@fadroma/scrt'
import { Chain, Token } from '@fadroma/agent'
import { Path } from '@hackbg/file'

export type Version = `1.${9|10|11|12}`

export const versions: Record<Version, ReturnType<typeof version>> = {
  '1.9':  version(
    '1.9',
    'ghcr.io/scrtlabs/localsecret:v1.9.3',
    '3da3483719797163c138790e2acb85dd0b3c64e512ce134336ab96ccb5699577'
  ),
  '1.10': version(
    '1.10',
    'ghcr.io/scrtlabs/localsecret:v1.10.0',
    '3c7bbf2c0c3ec9808c235d3e8157819ec6f8803e428cb8b60ff902c59ef06e52'
  ),
  '1.11': version(
    '1.11',
    'ghcr.io/scrtlabs/localsecret:v1.11.0',
    '75fce4df6739e8d3aca0bcf0d0962d358dbe9463891335fd97700d46c512e277'
  ),
  '1.12': version(
    '1.12',
    'ghcr.io/scrtlabs/localsecret:v1.12.1',
    '5f0e1bfe10066deb6c86e1965c9b09b13cecc36a007ca50eb87630eebd2b294c'
  )
}

export function version (platformVersion: Version, baseImage: string, baseSha256: string) {
  const platformName: Lowercase<keyof typeof Platform> = 'scrt'
  const image = PlatformBase.ubuntuDevnet({ platformName, platformVersion, baseImage, baseSha256 })
  return {
    platformName,
    platformVersion,
    Connection:   Scrt.ScrtConnection as { new (...args: unknown[]): Chain.Connection },
    Identity:     Scrt.ScrtMnemonicIdentity as { new (...args: unknown[]): Chain.Identity },
    gasToken:     new Token.Native('uscrt'),
    nodePortMode: 'http' as APIMode,
    bech32Prefix: 'scrt',
    waitString:   'Validating proposal',
    nodeBinary:   'secretd',
    container:    { image },
  }
}
