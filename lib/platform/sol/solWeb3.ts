import { default as Anchor, web3 } from '@coral-xyz/anchor';
import {
  ok, equal, expect, forbid, Fn, Name,
  Case, resolve, homedir,
  Anchor, Program, workspace,
  ACCOUNT_SIZE, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ExtensionType, getMintLen,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToInstruction,
  createApproveInstruction,
  getMinimumBalanceForRentExemptAccount,
} from './deps.ts';
import type { Name, MaybeAsync } from './deps.ts';
export const BN = Anchor.BN;
export const KP = web3.Keypair;
export const PK = web3.PublicKey;
export const TX = web3.Transaction;
export type BN = InstanceType<typeof Anchor.BN>;
export type KP = InstanceType<typeof web3.Keypair>;
export type PK = InstanceType<typeof web3.PublicKey>;
export type TX = InstanceType<typeof web3.Transaction>;
import { env } from './deps.ts';
env.ANCHOR_PROVIDER_URL ??= 'http://localhost:8899';
env.ANCHOR_WALLET ??= resolve(homedir(), '.config/solana/id.json'); // FIXME use XDG
export { Anchor, Program, workspace }
export const wallet = Anchor.AnchorProvider.env().wallet
export const { payer, publicKey } = wallet;
export const commitment  = 'processed'
export const connection  = new Anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL, commitment);
export const accountRent = await getMinimumBalanceForRentExemptAccount(connection);
export const provider    = new Anchor.AnchorProvider(connection, wallet);
Anchor.setProvider(provider);

export const get = (pubkey: PK) => connection.getAccountInfo(pubkey)

export const pda = (program: Program, seeds: Seeds) => PK.findProgramAddressSync(seeds.map(toSeed), program)[0]

export const toSeed = (seed: Seed) => {
  if (seed instanceof PK) seed = seed.toBuffer()
  if (seed instanceof BN || typeof seed === 'bigint' || typeof seed === 'number') seed = numToBuf(seed)
  return seed
}

export const numToBuf = (n: string|number|bigint|InstanceType<typeof BN>) => {
  if (!(typeof n === 'bigint')) n = BigInt(String(n))
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(n, 0);
  return bytes;
}

export const getBalances = (keys: PK[]) =>
  Promise.all(keys.map(key=>connection.getBalance(key)))
export const lazy = async ix => {
  ix = await ix
  if (typeof ix === 'function') ix = ix()
  return await ix
}
const axByName = (a, b) => (a[0] > b[0]) ? 1 : (a[0] < b[0]) ? -1 : 0
const maxLength = 30//prepared.reduce((max, [name, _])=>Math.max(max, name.length), 28)
function fields (fields) {
  return fields.join('\n     ')
}
function grouped (groups = [], item, index) {
  const group = Math.floor(index / 16)
  groups[group] ??= []
  groups[group].push(item)
  return groups
}
const toProgram = <T extends {}>(id: string, api?: (_: PK)=>T) =>
  Object.assign(api ? api(new PK(id)) : {}, { programId: new PK(id) });
