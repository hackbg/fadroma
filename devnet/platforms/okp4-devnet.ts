import type { APIMode } from '../devnet-base'
import DevnetContainer, { packageRoot, Error } from '../devnet-base'
import { connect } from '../devnet-impl'
import { Core, Token } from '@fadroma/agent'
import { OKP4Connection, OKP4MnemonicIdentity } from '@fadroma/cw'
import * as OCI from '@fadroma/oci'
import { Path } from '@hackbg/file'

type OKP4Version = `${5|6}.0`

export default class OKP4Container<V extends OKP4Version> extends DevnetContainer {

  constructor ({
    platformVersion = '6.0',
    ...properties
  }: Partial<OKP4Container<V> & {
    platformVersion: OKP4Version
  }>) {
    const supported = Object.keys(new.target.v)
    if (!supported.includes(platformVersion)) {
      throw new Error(
        `Unsupported version: ${platformVersion}. ` +
        `Specify one of the following: ${Object.keys(OKP4Container.v).join(', ')}`
      )
    }
    super({
      ...new.target.v[platformVersion] || {},
      ...properties,
      platformVersion,
      platformName: 'okp4',
    })
  }

  async connect (parameter: string|Partial<OKP4MnemonicIdentity & {
    mnemonic?: string
  }> = {}): Promise<OKP4Connection> {
    return connect(this, OKP4Connection, OKP4MnemonicIdentity, parameter)
  }

  gasToken = new Token.Native('uknow')

  /** Supported versions of OKP4. */
  static v: Record<OKP4Version, Partial<OKP4Container<OKP4Version>>> = {
    '5.0': okp4Version('5.0'),
    '6.0': okp4Version('5.0'),
  }

}

export function okp4Version (v: OKP4Version): Partial<OKP4Container<typeof v>> {
  const image = new OCI.Image({
    name: `ghcr.io/hackbg/fadroma-devnet-okp4-${v}:master`,
    dockerfile: new Path(packageRoot, 'platforms', `okp4-${v}.Dockerfile`).absolute,
    inputFiles: [`devnet.init.mjs`]
  })
  return {
    nodeBinary:   'okp4d',
    nodePortMode: 'rpc' as APIMode,
    platform:     `okp4-${v}`,
    waitString:   'indexed block',
    container:    new OCI.Container({ image }),
  }
}
