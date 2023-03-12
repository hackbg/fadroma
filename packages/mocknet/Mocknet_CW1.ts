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

import type { Address, ChainId, Client, CodeHash, Message } from '@fadroma/core'

import { bech32 } from '@hackbg/4mat'
import { bold } from '@hackbg/logs'

export default class Mocknet_CW1 extends Mocknet {
  backend = new MocknetBackend_CW1(this.id)
}

export class MocknetBackend_CW1 extends MocknetBackend {
  /** Contract host class for CW1. */
  static Contract: typeof MocknetContract_CW1

  context (
    sender:   Address,
    address?: Address,
    codeHash: CodeHash|undefined = address ? this.instances[address]?.codeHash : undefined,
    now:      number             = + new Date()
  ): [unknown, unknown] {
    return makeContext_CW1(this.chainId, sender, address, codeHash, now)
  }

  async query ({ address, codeHash }: Partial<Client>, msg: Message) {
    const [env] = this.context('', address, codeHash)
    const result = b64toUtf8(parseResult(this.getInstance(address).query(env, msg), 'query', address))
    return JSON.parse(result)
  }
}

/** The API that a CW1.0 contract expects. */
export interface ContractImports_CW1 extends ContractImports {
  env: ContractImports['env'] & {
    addr_canonicalize        (src:  Ptr, dst: Ptr): ErrCode
    addr_humanize            (src:  Ptr, dst: Ptr): ErrCode
    addr_validate            (addr: Ptr):           ErrCode
    debug                    (key:  Ptr):           Ptr
    ed25519_batch_verify     (x:    Ptr):           Ptr
    ed25519_sign             (x:    Ptr, y:   Ptr): Ptr
    ed25519_verify           (x:    Ptr, y:   Ptr): Ptr
    secp256k1_recover_pubkey (x:    Ptr):           Ptr
    secp256k1_sign           (x:    Ptr, y:   Ptr): Ptr
    secp256k1_verify         (x:    Ptr, y:   Ptr): Ptr
  }
}

/** A CW1.0 contract's raw API methods. */
export interface ContractExports_CW1 extends ContractExports {
  instantiate      (env: Ptr, info: Ptr, msg: Ptr): Ptr
  execute          (env: Ptr, info: Ptr, msg: Ptr): Ptr
  requires_staking ():                              Ptr
}

export class MocknetContract_CW1 extends MocknetContract<
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

/** Create the Env and Info context parameters for a CW1 contract. */
export function makeContext_CW1 (
  chain_id:  ChainId,
  sender:    Address,
  address?:  Address,
  codeHash?: CodeHash|undefined,
  now:       number = + new Date()
): [unknown, unknown] {
  if (!address) throw new Error.ContextNoAddress()
  const { height, time, sent_funds } = makeContext()
  return [{
    block:       { height, time: String(time), chain_id },
    transaction: { index: 0 },
    contract:    { address }
  }, {
    sender, funds: []
  }]
}

export function makeImports_CW1 (contract: MocknetContract<
  ContractImports_CW1,
  ContractExports_CW1
>) {

  const log = contract.log

  const { memory, getExports, env } = makeImports(contract)

  const cw1Methods = {

    addr_canonicalize (srcPtr: Ptr, dstPtr: Ptr) {
      const exports = getExports()
      const human   = readUtf8(exports, srcPtr)
      const canon   = bech32.fromWords(bech32.decode(human).words)
      const dst     = region(exports.memory.buffer, dstPtr)
      log.trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
      writeToRegion(exports, dstPtr, canon)
      return 0
    },

    addr_humanize (srcPtr: Ptr, dstPtr: Ptr) {
      const exports = getExports()
      const canon   = readBuffer(exports, srcPtr)
      const human   = bech32.encode(ADDRESS_PREFIX, bech32.toWords(canon))
      const dst     = region(exports.memory.buffer, dstPtr)
      log.trace(bold(contract.address), `humanize:`, canon, '->', human)
      writeToRegionUtf8(exports, dstPtr, human)
      return 0
    },

    addr_validate (srcPtr: Ptr) {
      log.warn('addr_validate: not implemented')
      return 0
    },

    secp256k1_recover_pubkey () {
      log.warn('sec256k1_recover_pubkey: not implemented')
      return 0
    },

    secp256k1_sign () {
      log.warn('sec256k1_sign: not implemented')
      return 0
    },

    secp256k1_verify () {
      log.warn('sec256k1_verify: not implemented')
      return 0
    },

    ed25519_batch_verify () {
      log.warn('ed25519_batch_verify: not implemented')
      return 0
    },

    ed25519_sign () {
      log.warn('ed25519_sign: not implemented')
      return 0
    },

    ed25519_verify () {
      log.warn('ed25519_verify: not implemented')
      return 0
    },

    debug (ptr: Ptr) {
      const exports = getExports()
      log.trace(bold(contract.address), `debug:`, readUtf8(exports, ptr))
      return 0
    },

  }

  return { memory, env: { ...env, ...cw1Methods } }

}
