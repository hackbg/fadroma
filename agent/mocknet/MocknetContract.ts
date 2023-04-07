import Console from './MocknetConsole'
import type MocknetBackend from './MocknetBackend'
import type { Ptr, ErrCode, IOExports } from './MocknetData'
import {
  parseResult, b64toUtf8, readBuffer, passBuffer,
  ADDRESS_PREFIX, codeHashForBlob, pass, readUtf8, writeToRegion, writeToRegionUtf8, region
} from './MocknetData'
import type ContractImports from './MocknetImports'
import type ContractExports from './MocknetExports'

import * as Fadroma from '@fadroma/agent'
import type { Address, CodeHash, CodeId, Message } from '@fadroma/agent'
import { bold } from '@fadroma/agent'

import { randomBech32 } from '@hackbg/4mat'

declare namespace WebAssembly {
  class Memory {
    constructor ({ initial, maximum }: { initial: number, maximum: number })
    buffer: any
  }
  class Instance<T> {
    exports: T
  }
  function instantiate (code: unknown, world: unknown): {
    instance: WebAssembly.Instance<ContractExports>
  }
}

export type CW = '0.x' | '1.x'

export default abstract class MocknetContract<I extends ContractImports, E extends ContractExports> {

  log = new Console('@fadroma/agent: Mocknet')

  instance?: WebAssembly.Instance<E>

  storage = new Map<string, Buffer>()

  constructor (
    readonly backend: MocknetBackend|null = null,
    readonly address: Address = randomBech32(ADDRESS_PREFIX),
    readonly codeHash?: CodeHash,
    readonly codeId?: CodeId,
  ) {
    this.log.trace('Instantiating', bold(address))
  }

  async load (code: unknown, codeId?: CodeId) {
    return Object.assign(this, {
      codeId:   this.codeId,
      instance: (await WebAssembly.instantiate(code, this.makeImports())).instance,
      codeHash: codeHashForBlob(code as Buffer)
    })
  }

  pass (data: any): Ptr {
    return pass(this.instance!.exports, data)
  }

  readUtf8 (ptr: Ptr) {
    return JSON.parse(readUtf8(this.instance!.exports, ptr))
  }

  abstract makeImports (): I

  abstract initPtrs (...args: unknown[]): unknown[]

  abstract get initMethod (): Function

  abstract execPtrs (...args: unknown[]): unknown[]

  abstract get execMethod (): Function

  abstract queryPtrs (...args: unknown[]): unknown[]

  abstract get queryMethod (): Function

  init (...args: unknown[]) {
    const msg = args[args.length - 1]
    this.log.log(bold(this.address), `init: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.initMethod(...this.initPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on init:`, e.message)
      this.log.error(bold('Args:'), ...args)
      throw e
    }
  }

  execute (...args: unknown[]) {
    const msg = args[args.length - 1]
    this.log.log(bold(this.address), `handle: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.execMethod(...this.execPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      this.log.error(bold('Args:'), ...args)
      throw e
    }
  }

  query (...args: unknown[]) {
    const msg = args[args.length - 1]
    this.log.log(bold(this.address), `query: ${JSON.stringify(msg)}`)
    try {
      return this.readUtf8(this.queryMethod(...this.queryPtrs(...args)))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

}
