import Error from './MocknetError'
import Mocknet from './MocknetChain'
import MocknetBackend from './MocknetBackend'
import MocknetContract from './MocknetContract'
import {
  b64toUtf8,
  parseResult,
  readBuffer,
  readUtf8,
  region,
  writeToRegion,
  writeToRegionUtf8,
  ADDRESS_PREFIX
} from './MocknetData'
import { makeImports } from './MocknetImports'
import { makeContext } from './MocknetExports'
import type { Ptr, ErrCode } from './MocknetData'
import type ContractExports from './MocknetExports'
import type ContractImports from './MocknetImports'

import type { Address, ChainId, Client, CodeHash, Message } from '../core/index'

import { bech32 } from '@hackbg/4mat'
import { bold } from '@hackbg/logs'

export default class Mocknet_CW0 extends Mocknet {
  backend = new MocknetBackend_CW0(this.id)
}

export class MocknetBackend_CW0 extends MocknetBackend {
  /** Contract host class for CW0. */
  static Contract: typeof MocknetContract_CW0

  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown] {
    return makeContext_CW0(this.chainId, sender, address, codeHash, now)
  }

  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const result = b64toUtf8(parseResult(this.getInstance(address).query(msg), 'query', address))
    return JSON.parse(result)
  }
}

/** The API that a CW0.10 contract expects. */
export interface ContractImports_CW0 extends ContractImports {
  env: ContractImports['env'] & {
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
  }
}

/** A CW0.10 contract's raw API methods. */
export interface ContractExports_CW0 extends ContractExports {
  init   (env: Ptr, msg: Ptr): Ptr
  handle (env: Ptr, msg: Ptr): Ptr
}

export class MocknetContract_CW0 extends MocknetContract<
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

/** Create the Env context parameter for a CW0 contract. */
export function makeContext_CW0 (
  chain_id:  ChainId,
  sender:    Address,
  address?:  Address,
  codeHash?: CodeHash|undefined,
  now:       number = + new Date()
): [unknown] {
  if (!address) throw new Error.ContextNoAddress()
  const { height, time, sent_funds } = makeContext()
  return [{
    block:    { height, time, chain_id },
    message:  { sender, sent_funds },
    contract: { address },
    contract_key: "",
    contract_code_hash: codeHash
  }]
}

export function makeImports_CW0 (contract: MocknetContract<
  ContractImports_CW0,
  ContractExports_CW0
>) {

  const log = contract.log

  const { memory, getExports, env } = makeImports(contract)

  const cw0Methods = {

    canonicalize_address (srcPtr: Ptr, dstPtr: Ptr) {
      const exports = getExports()
      const human   = readUtf8(exports, srcPtr)
      const canon   = bech32.fromWords(bech32.decode(human).words)
      const dst     = region(exports.memory.buffer, dstPtr)
      log.trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
      writeToRegion(exports, dstPtr, canon)
      return 0
    },

    humanize_address (srcPtr: Ptr, dstPtr: Ptr) {
      const exports = getExports()
      const canon   = readBuffer(exports, srcPtr)
      const human   = bech32.encode(ADDRESS_PREFIX, bech32.toWords(canon))
      const dst     = region(exports.memory.buffer, dstPtr)
      log.trace(bold(contract.address), `humanize:`, canon, '->', human)
      writeToRegionUtf8(exports, dstPtr, human)
      return 0
    },

  }

  return { memory, env: { ...env, ...cw0Methods } }

}
