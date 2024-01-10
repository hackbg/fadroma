import $ from '@hackbg/file'
import type { APIMode } from './devnet'
import DevnetContainer from './devnet-base'
import { connect } from './devnet-impl'
import { OKP4Connection, OKP4MnemonicIdentity } from '@fadroma/cw'
import { packageRoot } from './package'

type OKP4Version = '5.0'

export default class OKP4Container<V extends OKP4Version> extends DevnetContainer {

  constructor ({
    version = '5.0', ...properties
  }: Partial<OKP4Container<V> & {
    version: keyof typeof OKP4Container.v
  }>) {
    const supported = Object.keys(new.target.v)
    if (!supported.includes(version)) {
      throw new Error(
        `Unsupported version: ${version}. ` +
        `Specify one of the following: ${Object.keys(OKP4Container.v).join(', ')}`
      )
    }
    super({ ...new.target.v[version] || {}, ...properties })
  }

  async connect (parameter: string|Partial<OKP4MnemonicIdentity & {
    mnemonic?: string
  }> = {}): Promise<OKP4Connection> {
    return connect(this, OKP4Connection, OKP4MnemonicIdentity, parameter)
  }

  get spawnEnv () {
    return { ...super.spawnEnv, TOKEN: 'uknow' }
  }

  /** Supported versions of OKP4. */
  static v: Record<OKP4Version, Partial<OKP4Container<OKP4Version>>> = {
    '5.0': okp4Version('5.0')
  }
}

export function okp4Version (v: OKP4Version): Partial<OKP4Container<typeof v>> {
  const w = v.replace(/\./g, '_')
  return {
    containerImageTag: `ghcr.io/hackbg/fadroma-devnet-okp4-${v}:master`,
    containerManifest: $(packageRoot, `okp4_${w}.Dockerfile`).path,
    nodeBinary:        'okp4d',
    nodePortMode:      'rpc' as APIMode,
    platform:          `okp4_${w}`,
    readyString:       'indexed block',
  }
}
