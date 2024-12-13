import type * as Namada from './namadaTypes.ts'
import { fetchTotalStaked } from './namadaFetchTotalStaked.ts'

/** Fetch info about the set of validators currently participating in consensus. */
export async function fetchValidatorsConsensus (
  connection: Namada.ConnectionBase,
  epoch?:     Namada.Epoch
) {
  let query = "/vp/pos/validator_set/consensus"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await connection.abciQuery(query)
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

/** Fetch info about the set of validators currently below capacity. */
export async function fetchValidatorsBelowCapacity (
  connection: Namada.ConnectionBase,
  epoch?:     Namada.Epoch
) {
  let query = "/vp/pos/validator_set/below_capacity"
  if (epoch!==undefined) query += `/${epoch}`
  const binary = await connection.abciQuery(query)
  return connection.decode.pos_validator_set(binary).sort(byBondedStake)
}

/** Sorting function by the bondedStake parameter. */
const byBondedStake = (a: {bondedStake: number|bigint}, b: {bondedStake: number|bigint})=>
  (BigInt(a.bondedStake) > BigInt(b.bondedStake)) ? -1
    : (BigInt(a.bondedStake) < BigInt(b.bondedStake)) ?  1
    : 0

//export async function fetchValidatorsBelowCapacity2 (
  //connection: Namada.ConnectionBase
//) {
    //let validators = await fetchValidatorsBelowCapacity(connection)
    //if (options?.max) {
      //validators = validators.slice(0, options.max)
    //}
    //if (options?.percentage) {
      //const totalStake = Number(await this.fetchTotalStaked())
      //validators = validators.map((v: Partial<Namada.Validator>)=>Object.assign(v, {
        //bondedStake: Number(v.bondedStake),
        //stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      //}))
    //}
    //return validators.map((v: Partial<Namada.Validator>)=>Object.assign(v, {
      //status: 'below_capacity'
    //}))
//}

//export async function fetchValidatorsConsensus2 () {
    //let validators = await this.getConnection().fetchValidatorsConsensusImpl()
    //if (options?.max) {
      //validators = validators.slice(0, options.max)
    //}
    //if (options?.percentage) {
      //const totalStake = Number(await this.fetchTotalStaked())
      //validators = validators.map((v: Partial<Namada.Validator>)=>Object.assign(v, {
        //bondedStake: Number(v.bondedStake),
        //stakePercentage: (Number(v.bondedStake) / totalStake) * 100
      //}))
    //}
    //return validators.map((v: Partial<Namada.Validator>)=>Object.assign(v, { status: 'consensus' }))
//}
