import { packageRoot } from './package'
import type { APIMode } from './devnet-base'
import { connect } from './devnet-impl'
import DevnetContainer from './devnet-base'
import { Token } from '@fadroma/agent'
import * as OCI from '@fadroma/oci'
import { ScrtConnection, ScrtMnemonicIdentity } from '@fadroma/scrt'
import { Core } from '@fadroma/agent'
import { Path } from '@hackbg/file'

const { Error } = Core

type ScrtVersion = `1.${2|3|4|5|6|7|8|9}`

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
    '1.2': scrtVersion('1.2'),
    '1.3': scrtVersion('1.3'),
    '1.4': scrtVersion('1.4'),
    '1.5': scrtVersion('1.5'),
    '1.6': scrtVersion('1.6'),
    '1.7': scrtVersion('1.7'),
    '1.8': scrtVersion('1.8'),
    '1.9': scrtVersion('1.9'),
  }
}

function scrtVersion (v: ScrtVersion): Partial<ScrtContainer<typeof v>> {
  const w = v.replace(/\./g, '_')
  let waitString
  let nodePortMode: APIMode
  switch (v) {
    case '1.2':
      waitString   = 'indexed block'
      nodePortMode = 'http'
      break
    case '1.3':
      waitString   = 'indexed block'
      nodePortMode = 'grpcWeb'
      break
    case '1.4':
      waitString   = 'indexed block'
      nodePortMode = 'grpcWeb'
      break
    case '1.5':
      waitString   = 'indexed block'
      nodePortMode = 'http'
      break
    case '1.6':
      waitString   = 'indexed block'
      nodePortMode = 'http'
      break
    case '1.7':
      waitString   = 'indexed block'
      nodePortMode = 'http'
      break
    case '1.8':
      waitString   = 'Done verifying block height'
      nodePortMode = 'http'
      break
    case '1.9':
      waitString   = 'Validating proposal'
      nodePortMode = 'http'
      break
    default:
      throw new Error(`Unsupported version: scrt ${v}`)
  }
  const image = new OCI.Image({
    name: `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
    dockerfile: new Path(packageRoot, `scrt_${w}.Dockerfile`).absolute,
    inputFiles: [`devnet.init.mjs`]
  })
  return {
    nodePortMode,
    waitString,
    nodeBinary: 'secretd',
    platform:   `scrt_${w}`,
    container:  new OCI.Container({ image }),
  }
}
