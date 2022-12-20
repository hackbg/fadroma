import * as Fadroma from '@fadroma/core'
import type { Address, CodeHash, CodeId, Message } from '@fadroma/core'
import { ClientConsole, bold } from '@fadroma/core'
import { bech32, randomBech32, sha256, base16 } from '@hackbg/4mat'
import type { MocknetBackend } from './mocknet-backend'
import type { Ptr, ErrCode, IOExports } from './mocknet-data'
import { parseResult, b64toUtf8, readBuffer, passBuffer } from './mocknet-data'
import {
  ADDRESS_PREFIX, codeHashForBlob, pass, readUtf8, writeToRegion, writeToRegionUtf8, region
} from './mocknet-data'
import { MocknetConsole } from './mocknet-events'

import type { ContractImports, ContractImports_CW0, ContractImports_CW1 } from './mocknet-imports'
import { makeImports_CW0, makeImports_CW1 } from './mocknet-imports'

import { ContractExports, ContractExports_CW0, ContractExports_CW1 } from './mocknet-exports'

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

export type MocknetContract = MocknetContract_CW0|MocknetContract_CW1

export abstract class BaseMocknetContract<I extends ContractImports, E extends ContractExports> {

  log = new MocknetConsole('Fadroma Mocknet')

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

export class MocknetContract_CW0 extends BaseMocknetContract<
  ContractImports_CW0,
  ContractExports_CW0
> {

  get initMethod () {
    return this.instance!.exports.init
  }

  initPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }

  get execMethod () {
    return this.instance!.exports.handle
  }

  execPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }

  get queryMethod () {
    return this.instance!.exports.query
  }

  queryPtrs (msg: Message): [Ptr] {
    return [this.pass(msg)]
  }

  makeImports (): ContractImports_CW0 {
    return makeImports_CW0(this)
  }

}

export class MocknetContract_CW1 extends BaseMocknetContract<
  ContractImports_CW1,
  ContractExports_CW1
> {

  get initMethod () {
    return this.instance!.exports.instantiate
  }

  initPtrs (env: unknown, info: unknown, msg: Message): [Ptr, Ptr, Ptr] {
    return [this.pass(env), this.pass(info), this.pass(msg)]
  }

  get execMethod () {
    return this.instance!.exports.execute
  }

  execPtrs (env: unknown, info: unknown, msg: Message): [Ptr, Ptr, Ptr] {
    return [this.pass(env), this.pass(info), this.pass(msg)]
  }

  get queryMethod () {
    return this.instance!.exports.query
  }

  queryPtrs (env: unknown, msg: Message): [Ptr, Ptr] {
    return [this.pass(env), this.pass(msg)]
  }

  makeImports (): ContractImports_CW1 {
    return makeImports_CW1(this)
  }

}
