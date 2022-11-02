import * as Fadroma from '@fadroma/client'
import type { Address, CodeHash, CodeId, Message } from '@fadroma/client'
import { ClientConsole, bold } from '@fadroma/client'
import { bech32, randomBech32, sha256, base16 } from '@hackbg/formati'
import type { MocknetBackend } from './mocknet-backend'
import type { Ptr, ErrCode, IOExports } from './mocknet-data'
import { parseResult, b64toUtf8, readBuffer, passBuffer } from './mocknet-data'
import {
  ADDRESS_PREFIX, codeHashForBlob, pass, readUtf8, writeToRegion, writeToRegionUtf8, region
} from './mocknet-data'

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

export class MocknetContract {

  log = new ClientConsole('Fadroma Mocknet')

  constructor (
    readonly backend:   MocknetBackend|null = null,
    readonly address:   Address     = randomBech32(ADDRESS_PREFIX),
    readonly codeHash?: CodeHash,
    readonly codeId?:   CodeId,
  ) {
    this.log.trace('Instantiating', bold(address))
  }

  instance?: WebAssembly.Instance<ContractExports>

  storage = new Map<string, Buffer>()

  async load (code: unknown, codeId?: CodeId) {
    return Object.assign(this, {
      codeId:   this.codeId,
      instance: (await WebAssembly.instantiate(code, this.makeImports())).instance,
      codeHash: codeHashForBlob(code as Buffer)
    })
  }

  init (env: unknown, info: unknown, msg: Message) {
    this.log.debug(`${bold(this.address)} init:`, msg)
    try {
      return this.readUtf8(this.instance!.exports.init(
        this.pass(env),
        this.pass(info),
        this.pass(msg)
      ))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on init:`, e.message)
      throw e
    }
  }

  execute (env: unknown, info: unknown, msg: Message) {
    this.log.debug(`${bold(this.address)} handle:`, msg)
    try {
      return this.readUtf8(this.instance!.exports.execute(
        this.pass(env),
        this.pass(info),
        this.pass(msg)
      ))
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on handle:`, e.message)
      throw e
    }
  }

  query (msg: Message) {
    this.log.debug(`${bold(this.address)} query:`, msg)
    try {
      const msgBuf = this.pass(msg)
      const retPtr = this.instance!.exports.query(msgBuf)
      const retBuf = this.readUtf8(retPtr)
      return retBuf
    } catch (e: any) {
      this.log.error(bold(this.address), `crashed on query:`, e.message)
      throw e
    }
  }

  pass (data: any): Ptr {
    return pass(this.instance!.exports, data)
  }

  readUtf8 (ptr: Ptr) {
    return JSON.parse(readUtf8(this.instance!.exports, ptr))
  }

  /** TODO: these are different for different chains. */
  makeImports (): ContractImports {
    const { log } = this
    // don't destructure - when first instantiating the
    // contract, `this.instance` is still undefined
    const contract = this
    // initial blank memory
    const memory   = new WebAssembly.Memory({ initial: 32, maximum: 128 })
    // when reentering, get the latest memory
    const getExports = () => ({
      memory:   contract.instance!.exports.memory,
      allocate: contract.instance!.exports.allocate,
    })
    return {
      memory,
      env: {
        db_read (keyPtr) {
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
        db_write (keyPtr, valPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          const val     = readBuffer(exports, valPtr)
          contract.storage.set(key, val)
          log.trace(bold(contract.address), `db_write:`, bold(key), '=', val)
        },
        db_remove (keyPtr) {
          const exports = getExports()
          const key     = readUtf8(exports, keyPtr)
          log.trace(bold(contract.address), `db_remove:`, bold(key))
          contract.storage.delete(key)
        },
        canonicalize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const human   = readUtf8(exports, srcPtr)
          const canon   = bech32.fromWords(bech32.decode(human).words)
          const dst     = region(exports.memory.buffer, dstPtr)
          log.trace(bold(contract.address), `canonize:`, human, '->', `${canon}`)
          writeToRegion(exports, dstPtr, canon)
          return 0
        },
        humanize_address (srcPtr, dstPtr) {
          const exports = getExports()
          const canon   = readBuffer(exports, srcPtr)
          const human   = bech32.encode(ADDRESS_PREFIX, bech32.toWords(canon))
          const dst     = region(exports.memory.buffer, dstPtr)
          log.trace(bold(contract.address), `humanize:`, canon, '->', human)
          writeToRegionUtf8(exports, dstPtr, human)
          return 0
        },
        query_chain (reqPtr) {
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
    }
  }

}

/** Contract's raw API methods, taking and returning heap pointers. */
export interface ContractExports extends IOExports {
  init    (env: Ptr, info: Ptr, msg: Ptr): Ptr
  execute (env: Ptr, info: Ptr, msg: Ptr): Ptr
  query   (msg: Ptr):                      Ptr
}

export interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read              (key: Ptr):           Ptr
    db_write             (key: Ptr, val: Ptr): void
    db_remove            (key: Ptr):           void
    canonicalize_address (src: Ptr, dst: Ptr): ErrCode
    humanize_address     (src: Ptr, dst: Ptr): ErrCode
    query_chain          (req: Ptr):           Ptr
  }
}
