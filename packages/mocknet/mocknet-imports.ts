import { bech32 } from '@hackbg/formati'
import { bold } from '@fadroma/core'

import {
  ADDRESS_PREFIX,
  b64toUtf8, readUtf8, pass, passBuffer, readBuffer, parseResult,
  region, writeToRegion, writeToRegionUtf8
} from './mocknet-data'
import type { Ptr, ErrCode } from './mocknet-data'
import type { MocknetContract } from './mocknet-contract'

export interface ContractImports_Base {
  memory: WebAssembly.Memory
  env: {
    db_read     (key: Ptr):           Ptr
    db_write    (key: Ptr, val: Ptr): void
    db_remove   (key: Ptr):           void
    query_chain (req: Ptr):           Ptr
  }
}

/** The API that a CW0.10 contract expects. */
export interface ContractImports_CW0 extends ContractImports_Base {
  env: ContractImports_Base['env'] & {
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
  }
}

/** The API that a CW1.0 contract expects. */
export interface ContractImports_CW1 {
  env: ContractImports_Base['env'] & {
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

/** The API that a contract expects. */
export type ContractImports = ContractImports_CW0 | ContractImports_CW1

export function makeImports (contract: MocknetContract): ContractImports_Base & { getExports: Function } {

  const log = contract.log

  // initial memory
  const memory = new WebAssembly.Memory({ initial: 32, maximum: 128 })

  // when reentering, get the latest memory
  const getExports = () => ({
    memory:   contract.instance!.exports.memory,
    allocate: contract.instance!.exports.allocate,
  })

  const methods = {

    db_read (keyPtr: Ptr) {
      const exports = getExports()
      const key     = readUtf8(exports, keyPtr)
      const val     = contract.storage.get(key)
      log.trace(bold(contract.address), `db_read:`, bold(key), '=', val)
      if (contract.storage.has(key)) {
        return passBuffer(exports, val!)
      } else {
        return 0
      }
    },

    db_write (keyPtr: Ptr, valPtr: Ptr) {
      const exports = getExports()
      const key     = readUtf8(exports, keyPtr)
      const val     = readBuffer(exports, valPtr)
      contract.storage.set(key, val)
      log.trace(bold(contract.address), `db_write:`, bold(key), '=', val)
    },

    db_remove (keyPtr: Ptr) {
      const exports = getExports()
      const key     = readUtf8(exports, keyPtr)
      log.trace(bold(contract.address), `db_remove:`, bold(key))
      contract.storage.delete(key)
    },

    query_chain (reqPtr: Ptr) {
      const exports  = getExports()
      const req      = readUtf8(exports, reqPtr)
      log.trace(bold(contract.address), 'query_chain:', req)
      const { wasm } = JSON.parse(req)
      if (!wasm) {
        throw new Error(
          `MocknetContract ${contract.address} made a non-wasm query:`+
          ` ${JSON.stringify(req)}`
        )
      }
      const { smart } = wasm
      if (!wasm) {
        throw new Error(
          `MocknetContract ${contract.address} made a non-smart wasm query:`+
          ` ${JSON.stringify(req)}`
        )
      }
      if (!contract.backend) {
        throw new Error(
          `MocknetContract ${contract.address} made a query while isolated from`+
          ` the MocknetBackend: ${JSON.stringify(req)}`
        )
      }
      const { contract_addr, callback_code_hash, msg } = smart
      const queried = contract.backend.getInstance(contract_addr)
      if (!queried) {
        throw new Error(
          `MocknetContract ${contract.address} made a query to contract ${contract_addr}` +
          ` which was not found in the MocknetBackend: ${JSON.stringify(req)}`
        )
      }
      const decoded = JSON.parse(b64toUtf8(msg))
      log.debug(`${bold(contract.address)} queries ${contract_addr}:`, decoded)
      const result = parseResult(queried.query(decoded), 'query_chain', contract_addr)
      log.debug(`${bold(contract_addr)} responds to ${contract.address}:`, b64toUtf8(result))
      return pass(exports, { Ok: { Ok: result } })
      // https://docs.rs/secret-cosmwasm-std/latest/secret_cosmwasm_std/type.QuerierResult.html
    }

  }

  return { memory, getExports, env: methods }

}

export function makeImports_CW0 (contract: MocknetContract) {

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

export function makeImports_CW1 (contract: MocknetContract) {

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

    debug () {
      log.warn('debug: not implemented')
      return 0
    },

  }

  return { memory, env: { ...env, ...cw1Methods } }

}
