import { env } from 'node:process';
import { resolve } from 'node:path'
import { homedir } from 'node:os'
env.ANCHOR_PROVIDER_URL ??= 'http://localhost:8899';
env.ANCHOR_WALLET ??= resolve(homedir(), '.config/solana/id.json'); // FIXME use XDG
import * as Anchor from "@coral-xyz/anchor";
import { Program, workspace } from "@coral-xyz/anchor";
import { getMinimumBalanceForRentExemptAccount } from '@solana/spl-token';
export { Anchor, Program, workspace }
export const BN = Anchor['default']['BN'];
export const KP = Anchor.web3.Keypair;
export const PK = Anchor.web3.PublicKey;
export const TX = Anchor.web3.Transaction;
export type BN = InstanceType<typeof Anchor.BN>;
export type KP = InstanceType<typeof Anchor.web3.Keypair>;
export type PK = InstanceType<typeof Anchor.web3.PublicKey>;
export type TX = InstanceType<typeof Anchor.web3.Transaction>;
export const wallet = Anchor.AnchorProvider.env().wallet
export const { payer, publicKey } = wallet;
export const commitment  = 'processed'
export const connection  = new Anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL, commitment);
export const accountRent = await getMinimumBalanceForRentExemptAccount(connection);
export const provider    = new Anchor.AnchorProvider(connection, wallet);
Anchor.setProvider(provider);
export const get = (pubkey) => connection.getAccountInfo(pubkey)
export const pda = (program, seeds) => PK.findProgramAddressSync(seeds.map(toSeed), program)[0]
export const toSeed = seed => {
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
export const { Transaction, Keypair } = Anchor.web3
export const getBalances = keys => Promise.all(keys.map(key=>connection.getBalance(key)))
