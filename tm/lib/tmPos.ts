import type { Core } from '../deps.ts'
import { uint32 } from '../deps.ts'
import type { Api } from './tm.ts'
import { Error, Console } from './tmLog.ts'
/** A Namada validator. */
export interface Validator {
  address?: Core.Address,
  publicKey?: Core.Hash,
  votingPower: bigint,
  proposerPriority: bigint
}
export type FetchValidatorOptions = {
  height?:     Core.Height,
  pagination?: [number, number],
  details?:    boolean,
}
export const fetchValidators = async <V extends Validator> (
  api: Api, options?: FetchValidatorOptions
): Promise<[V[], number, number]> => {
  if (!api.url) throw new Error('fetchValidators: no api url')
  const { height, pagination: [page, per_page] = [], details } = options || {}
  const params  = {height, page, per_page}
  const message = {jsonrpc: '2.0', id: Console.randomId(), method: 'validators', params}
  const headers = {'Content-Type': 'application/json'}
  const body    = JSON.stringify(message)
  api.log.debug('fetchValidators:', body)
  const request = await fetch(api.url, {method: 'POST', body, headers})
  const json    = await request.json()
  const { result: { response }, error } = json
  if (error) {
    api.log.error('fetchValidators error:', error)
    throw new Error('fetchValidatorsError', { error })
  }
  // Sort validators by voting power in descending order.
  const validators = [...response.validators].sort(byVotingPowerDesc)
  if (options?.details) {
    for (const validator of validators) {
      const details = await api.fetchAbciQuery('/cosmos.staking.v1beta1.Query/Validator', new Uint8Array([
        ...new Uint8Array(uint32.fixedEncoder(10).bytes),
        ...new Uint8Array(uint32.fixedEncoder(validator.address.length).bytes),
        ...new TextEncoder().encode(validator.address)
      ])
    }
  }
  return [validators, response.count, response.total]
  //let response
  //if (pagination && (pagination as Array<number>).length !== 0) {
    //if (pagination.length !== 2) {
      //throw new Error("pagination format: [page, per_page]")
    //}
    //response = await tendermintClient!.validators({
      //page:     pagination[0],
      //per_page: pagination[1],
    //})
  //} else {
    //response = await tendermintClient!.validatorsAll()
  //}
}

export const byVotingPowerDesc = (a: Validator, b: Validator)=>(
  (a.votingPower < b.votingPower) ?  1 :
  (a.votingPower > b.votingPower) ? -1 : 0
)

const writeVarint32 = (val: number, buf: Uint8Array, pos: number) => {
    while (val > 127) {
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}
