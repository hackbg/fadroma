import type { APIMode } from '../devnet-base'
import DevnetContainer, { packageRoot, Error } from '../devnet-base'
import { connect } from '../devnet-impl'
import { Core, Token } from '@fadroma/agent'
import { ScrtConnection, ScrtMnemonicIdentity } from '@fadroma/scrt'
import * as OCI from '@fadroma/oci'
import { Path } from '@hackbg/file'

type ScrtVersion = `1.${9|10|11|12}`

export default class ScrtContainer<V extends ScrtVersion> extends DevnetContainer {
  constructor ({
    platformVersion = '1.9',
    ...properties
  }: Partial<ScrtContainer<V> & {
    platformVersion: ScrtVersion
  }>) {
    const supported = Object.keys(new.target.v)
    if (!supported.includes(platformVersion)) {
      throw new Error(
        `Unsupported version: ${platformVersion}. ` +
        `Specify one of the following: ${Object.keys(ScrtContainer.v).join(', ')}`
      )
    }
    super({
      ...new.target.v[platformVersion] || {}, 
      ...properties,
      platformVersion,
      platformName: 'scrt',
    })
  }

  async connect (parameter: string|Partial<ScrtMnemonicIdentity & {
    mnemonic?: string
  }> = {}): Promise<ScrtConnection> {
    return connect(this, ScrtConnection, ScrtMnemonicIdentity, parameter)
  }

  gasToken = new Token.Native('uscrt')

  /** Supported versions of Secret Network. */
  static v: Record<ScrtVersion, Partial<ScrtContainer<ScrtVersion>>> = {
    '1.9':  scrtVersion('1.9'),
    '1.10': scrtVersion('1.10'),
    '1.11': scrtVersion('1.11'),
    '1.12': scrtVersion('1.12'),
  }
}

function scrtVersion (v: ScrtVersion): Partial<ScrtContainer<typeof v>> {
  let waitString
  let nodePortMode: APIMode
  const image = new OCI.Image({
    name: `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
    dockerfile: new Path(packageRoot, 'platforms', `scrt-${v}.Dockerfile`).absolute,
    inputFiles: [`devnet.init.mjs`]
  })
  return {
    nodePortMode: 'http',
    waitString:   'Validating proposal',
    nodeBinary:   'secretd',
    platform:     `scrt-${v}`,
    container:    new OCI.Container({ image }),
  }
}
