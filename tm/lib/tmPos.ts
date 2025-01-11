import type { Core } from '../deps.ts'
import type { Context } from './tm.ts'
import { Error, Console } from './tmLog.ts'
/** A Namada validator. */
export interface Validator {
  address?: Core.Address,
  publicKey?: Core.Hash,
  votingPower: bigint,
  proposerPriority: bigint
}

/// TODO
export function getValidators <V extends Validator> (
  deps: Context,
  options?: {
    pagination?: [number, number],
    details?:    boolean,
  }
): Promise<Array<V>> {
  throw new Error('not implemented')
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
