import type {
  Agent, Address, Buildable, Built, Uploaded, Instantiated, AnyContract
} from '../index'
import { Error, Console, validated } from '../util'
import { assertAddress } from './Tx'

/** @returns a string in the format `crate[@ref][+flag][+flag]...` */
export function getSourceSpecifier (meta: Buildable): string {
  const { crate, revision, features } = meta
  let result = crate ?? ''
  if (revision !== 'HEAD') result = `${result}@${revision}`
  if (features && features.length > 0) result = `${result}+${features.join('+')}`
  return result
}

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** @returns the code hash of the thing
  * @throws  LinkNoCodeHash if missing. */
export function assertCodeHash ({ codeHash }: { codeHash?: CodeHash } = {}): CodeHash {
  if (!codeHash) throw new Error.LinkNoCodeHash()
  return codeHash
}

/** Fetch the code hash by id and by address, and compare them.
  * @returns the passed contract object but with codeHash set
  * @throws if unable to establish the code hash */
export async function fetchCodeHash (
  meta:   Partial<Built> & Partial<Uploaded> & Partial<Instantiated>,
  agent?: Agent|null|undefined, expected?: CodeHash,
): Promise<CodeHash> {
  if (!agent) throw new Error.NoAgent()
  if (!meta.address && !meta.codeId && !meta.codeHash) {
    throw new Error('Unable to fetch code hash: no address or code id.')
  }
  const codeHashByAddress = meta.address
    ? validated('codeHashByAddress', await agent.getHash(meta.address), expected)
    : undefined
  const codeHashByCodeId  = meta.codeId
    ? validated('codeHashByCodeId',  await agent.getHash(meta.codeId),  expected)
    : undefined
  if (codeHashByAddress && codeHashByCodeId && codeHashByAddress !== codeHashByCodeId) {
    throw new Error('Validation failed: different code hashes fetched by address and by code id.')
  }
  if (!codeHashByAddress && !codeHashByCodeId) {
    throw new Error('Code hash unavailable.')
  }
  return codeHashByAddress! ?? codeHashByCodeId!
}

/** Objects that have a code hash in either capitalization. */
export type Hashed = 
  | { code_hash: CodeHash }
  | { codeHash: CodeHash }

/** Allow code hash to be passed with either cap convention; warn if missing or invalid. */
export function codeHashOf (hashed: Hashed): CodeHash {
  let { code_hash, codeHash } = hashed as any
  if (typeof code_hash === 'string') code_hash = code_hash.toLowerCase()
  if (typeof codeHash  === 'string') codeHash  = codeHash.toLowerCase()
  if (code_hash && codeHash && code_hash !== codeHash) throw new Error.DifferentHashes()
  const result = code_hash ?? codeHash
  if (!result) throw new Error.NoCodeHash()
  return result
}

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** Retrieves the code ID corresponding to this contract's address/code hash.
  * @returns `this` but with `codeId` populated. */
export async function fetchCodeId <C extends AnyContract> (
  meta: C, agent: Agent, expected?: CodeId,
): Promise<CodeId> {
  return validated('codeId',
    String(await agent.getCodeId(assertAddress(meta))),
    (expected===undefined) ? undefined : String(expected)
  )
}
