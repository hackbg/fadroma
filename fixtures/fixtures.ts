import { withTmpDir } from '@hackbg/file'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import $, { BinaryFile } from '@hackbg/file'
import { Deployment, Console, bold } from '@fadroma/agent'

//@ts-ignore
export const here      = dirname(fileURLToPath(import.meta.url))
export const workspace = resolve(here)
export const fixture   = (...args: string[]) => resolve(here, ...args)
export const log       = new Console('Fadroma Testing')
export const nullWasm = readFileSync(fixture('empty.wasm'))
export const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]

export const examples: Record<string, any> = {}

function example (name: string, wasm: any, hash: any) {
  return examples[name] = {
    name,
    path: fixture(wasm),
    data: $(fixture(wasm)).as(BinaryFile),
    url:  $(fixture(wasm)).url,
    hash
  }
}

example('Empty',  'empty.wasm',                       'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
example('KV',     'fadroma-example-kv@HEAD.wasm',     '16dea8b55237085f24af980bbd408f1d6893384996e90e0ce2c6fc3432692a0d')
example('Echo',   'fadroma-example-echo@HEAD.wasm',   'a4983efece1306aa897651fff74cae18436fc3280fc430d11a4997519659b6fd')
example('Legacy', 'fadroma-example-legacy@HEAD.wasm', 'a5d58b42e686d9f5f8443eb055a3ac45018de2d1722985c5f77bad344fc00c3b')

export const tmpDir = () => {
  let x
  withTmpDir(dir=>x=dir)
  return x
}

export class TestBuildDeployment extends Deployment {

  a = this.contract('null-a', {
    language:  'rust',
    cargoToml: 'examples/contracts/cw-null/Cargo.toml'
  })

  b = this.template('null-b', {
    language:  'rust',
    cargoToml: 'examples/contracts/cw-null/Cargo.toml'
  }).contracts({
    b1: { initMsg: {} },
    b2: { initMsg: () => ({}) },
    b3: { initMsg: async () => ({}) }
  })

}

export class TestProjectDeployment extends Deployment {

  t = this.template('t', {
    chainId:   'stub',
    codeId:    '1',
    cargoToml: "examples/contracts/scrt-kv/Cargo.toml"
  })

  // Single template instance with eager and lazy initMsg
  a1 = this.t.contract('a1', {
    initMsg: {}
  })

  a2 = this.t.contract('a2', {
    initMsg: () => ({})
  })

  a3 = this.t.contract('a3', {
    initMsg: async () => ({})
  })

  // Multiple contracts from the same template
  b = this.t.contracts({
    b1: { initMsg: {} },
    b2: { initMsg: () => ({}) },
    b3: { initMsg: async () => ({}) }
  })

}
