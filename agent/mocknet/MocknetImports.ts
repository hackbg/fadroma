import Error from './MocknetError'
import {
  ADDRESS_PREFIX,
  b64toUtf8, readUtf8, pass, passBuffer, readBuffer, parseResult,
  region, writeToRegion, writeToRegionUtf8
} from './MocknetData'
import type { Ptr, ErrCode } from './MocknetData'
import type MocknetContract from './MocknetContract'

import { bold } from '@fadroma/agent'

import { bech32 } from '@hackbg/4mat'
import { brailleDump } from '@hackbg/dump'

export default interface ContractImports {
  memory: WebAssembly.Memory
  env: {
    db_read     (key: Ptr):           Ptr
    db_write    (key: Ptr, val: Ptr): void
    db_remove   (key: Ptr):           void
    query_chain (req: Ptr):           Ptr
  }
}

export function makeImports (
  contract: MocknetContract<any, any>
): ContractImports & { getExports: Function } {

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
      log.trace(bold(contract.address), `db_read: ${bold(key)}`, val ? brailleDump(val) : null)
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
      log.trace(bold(contract.address), `db_write: ${bold(key)}`, brailleDump(val))
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
