import type * as Namada from './namadaTypes.ts'
import { decode, u256 } from '../deps.ts'

/** Fetch details for a Namada validator. */
export async function fetchValidatorDetails (connection: Namada.ConnectionBase, options?: {
  epoch?:     Namada.Epoch,
  parallel?:  boolean,
  validator?: Partial<Namada.Validator>
}) {
  const { epoch, validator = {}, parallel = false } = options || {}
  if (!validator.namadaAddress) {
    if (!validator.address) {
      throw new Error('missing tendermint or namada address for validator')
    }
    const addressBinary = await connection.abciQuery(`/vp/pos/validator_by_tm_addr/${validator.address}`)
    validator.namadaAddress = connection.decode.address(addressBinary.slice(1))
    connection.log.info(validator.address, 'is', validator.namadaAddress)
  }
  const v = validator.namadaAddress
  const warn = (...args: Parameters<typeof connection["log"]["warn"]>) =>
    (e: Error) => {
      connection.log.warn(...args)
      return null
    }
  const requests: Array<()=>Promise<unknown>> = [
    () => connection.abciQuery(`/vp/pos/validator/metadata/${v}`)
      .then((binary: Uint8Array) => binary[0] && (validator.metadata = connection.decode.pos_validator_metadata(binary.slice(1))))
      .catch(warn(`Failed to provide validator metadata for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/commission/${v}`)
      .then((binary: Uint8Array) => validator.commission = connection.decode.pos_commission_pair(binary))
      .catch(warn(`Failed to provide validator commission pair for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/state/${v}` + (epoch?`/${epoch}`:''))
      .then((binary: Uint8Array) => validator.state = connection.decode.pos_validator_state(binary))
      .catch(warn(`Failed to provide validator state for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/stake/${v}` + (epoch?`/${epoch}`:''))
      .then((binary: Uint8Array) => binary[0] && (validator.stake = decode(u256, binary.slice(1))))
      .catch(warn(`Failed to provide validator stake for ${v}`)),
    () => connection.abciQuery(`/vp/pos/validator/consensus_key/${v}`)
      .then((binary: Uint8Array) => {
        const publicKey = base16.encode(binary.slice(2))
        if (validator.publicKey && (validator.publicKey !== publicKey)) {
          throw Object.assign(new Error(`Fetched different public key for ${v}`), {
            oldPublicKey: validator.publicKey,
            newPublicKey: publicKey
          })
        }
        validator.publicKey = publicKey
      })
      .catch(warn(`Failed to decode validator public key for ${v}`))
  ]
  const prefix = `validator ${v} details: ${requests.length} request(s)`
  if (options?.parallel) {
    connection.log.debug(prefix, `in parallel`)
  } else {
    connection.log.debug(prefix, `in sequence`)
  }
  await optionallyParallel(options?.parallel, requests)
  return validator
}
