import { withTmpDir } from '@hackbg/file'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import $, { BinaryFile } from '@hackbg/file'
import { Console, bold } from '@fadroma/agent'
import { StubAgent as Agent, StubChain as Chain, Uploader, Contract, Client } from '@fadroma/agent'

export const here      = dirname(fileURLToPath(import.meta.url))
export const workspace = resolve(here)
export const fixture   = x => resolve(here, x)
export const log       = new Console('Fadroma Testing')

export const nullWasm = readFileSync(fixture('null.wasm'))

export const mnemonics = [
  'canoe argue shrimp bundle drip neglect odor ribbon method spice stick pilot produce actual recycle deposit year crawl praise royal enlist option scene spy',
  'bounce orphan vicious end identify universe excess miss random bench coconut curious chuckle fitness clean space damp bicycle legend quick hood sphere blur thing'
]

export const examples = {
}

function example (name, wasm, hash) {
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

class MockChain extends Chain {
  uploads = new class MockUploader extends Uploader {
    resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
    make = () => new class MockFile {
      resolve = () => `/tmp/fadroma-test-upload-${Math.floor(Math.random()*1000000)}`
    }
  }
}

export const mockAgent = () => new class MockAgent extends Agent {

  chain = new MockChain('mock')

  async upload () { return {} }

  instantiate (template, label, initMsg) {
    return new Contract({ ...template, label, initMsg, address: 'some address' })
  }

  async instantiateMany (contract, configs) {
    const receipts = {}
    for (const [{codeId}, name] of configs) {
      let label = name
      receipts[name] = { codeId, label }
    }
    return receipts
  }

  async getHash () {
    return 'sha256'
  }

}

export const tmpDir = () => {
  let x
  withTmpDir(dir=>x=dir)
  return x
}
