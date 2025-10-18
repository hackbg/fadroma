import { default as Anchor, web3 } from '@coral-xyz/anchor';
export const BN = Anchor.BN;
export const KP = web3.Keypair;
export const PK = web3.PublicKey;
export const TX = web3.Transaction;
export type BN = InstanceType<typeof Anchor.BN>;
export type KP = InstanceType<typeof web3.Keypair>;
export type PK = InstanceType<typeof web3.PublicKey>;
export type TX = InstanceType<typeof web3.Transaction>;
