import $ from '@hackbg/file'
import type { Port } from './devnet-base'
import DevnetContainer from './devnet-base'
import { ScrtConnection, ScrtMnemonicIdentity } from '@fadroma/scrt'
import { packageRoot } from './package'

type ScrtVersion = `1.${2|3|4|5|6|7|8|9}`

export default class ScrtContainer<V extends ScrtVersion> extends DevnetContainer {
  static v: Record<ScrtVersion, Partial<ScrtContainer<ScrtVersion>>>  = {
    '1.2': scrtVersion('1.2'),
    '1.3': scrtVersion('1.3'),
    '1.4': scrtVersion('1.4'),
    '1.5': scrtVersion('1.5'),
    '1.6': scrtVersion('1.6'),
    '1.7': scrtVersion('1.7'),
    '1.8': scrtVersion('1.8'),
    '1.9': scrtVersion('1.9'),
  }

  constructor ({
    version = '1.9', ...properties
  }: Partial<ScrtContainer<V> & {
    version: keyof typeof ScrtContainer.v
  }>) {
    const supported = Object.keys(new.target.v)
    if (!supported.includes(version)) {
      throw new Error(
        `Unsupported version: ${version}. ` +
        `Specify one of the following: ${Object.keys(ScrtContainer.v).join(', ')}`
      )
    }
    super({ ...new.target.v[version] || {}, ...properties })
  }

  async connect (parameter: string|Partial<ScrtMnemonicIdentity & {
    mnemonic?: string
  }> = {}): Promise<ScrtConnection> {
    if (typeof parameter === 'string') {
      parameter = { name: parameter }
    }
    const { mnemonic } = parameter
    await this.containerStarted
    return new ScrtConnection({
      chainId:  this.chainId,
      url:      this.url?.toString(),
      alive:    this.running,
      identity: new ScrtMnemonicIdentity(mnemonic
        ? parameter as { mnemonic: string }
        : await this.getIdentity(parameter))
    })
  }
}

function scrtVersion (v: ScrtVersion) {
  const w = v.replace(/\./g, '_')
  let readyString
  let portMode: Port
  switch (v) {
    case '1.2':
      readyString = 'indexed block'
      portMode = 'http'
      break
    case '1.3':
      readyString = 'indexed block'
      portMode = 'grpcWeb' as Port
      break
    case '1.4':
      readyString = 'indexed block'
      portMode = 'grpcWeb' as Port
      break
    case '1.5':
      readyString = 'indexed block'
      portMode = 'http' as Port
      break
    case '1.6':
      readyString = 'indexed block'
      portMode = 'http' as Port
      break
    case '1.7':
      readyString = 'indexed block'
      portMode = 'http' as Port
      break
    case '1.8':
      readyString = 'Done verifying block height'
      portMode = 'http' as Port
      break
    case '1.9':
      readyString = 'Validating proposal'
      portMode = 'http' as Port
      break
  }
  return {
    platform:          `scrt_${w}`,
    containerImage:    `ghcr.io/hackbg/fadroma-devnet-scrt-${v}:master`,
    containerManifest: $(packageRoot, `scrt_${w}.Dockerfile`).path,
    daemon:            'secretd',
    readyString,
    portMode,
  }
}
