#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { p2pkh, p2wpkh } from 'npm:@scure/btc-signer';
import { pubSchnorr, pubECDSA } from 'npm:@scure/btc-signer/utils.js';
import { Test as The, Base16, Fn, randomBytes } from '../../index.ts';
import Btc from './Bitcoin.ts';
import { deepStrictEqual as equal } from 'node:assert';
const priv = new Uint8Array(Array(32).fill(1));
export default The(import.meta, 'Btc',
  The('Address',
    The('Schnorr', () => equal(Base16.encode(pubSchnorr(priv)), '1B84C5567B126440995D3ED5AABA0565D71E1834604819FF9C17F5E9D5DD078F')),
    The('ECDSA',   () => equal(Base16.encode(pubECDSA(priv)),   '031B84C5567B126440995D3ED5AABA0565D71E1834604819FF9C17F5E9D5DD078F')),
    The('P2PKH',   () => equal(p2pkh(pubECDSA(priv)).address,   '1C6Rc3w25VHud3dLDamutaqfKWqhrLRTaD')),
    The('P2WPKH',  () => equal(p2wpkh(pubECDSA(priv)).address,  'bc1q0xcqpzrky6eff2g52qdye53xkk9jxkvrh6yhyw'))),
  The('Node', Btc, (btc: Btc) => btc.kill()),
  The('RPC'),
  The('REST'),
  The('Esplora', 'Block', 'Transaction', 'UTXO', 'Address'));

/** Define test case for expected wallet balance. */
export function AssertBalance <T> (balance: T) {
  return Fn.Name(`Wallet balance is ${balance}`, (info: { balance: T }) => {
    equal(info.balance, balance)
  })
}

/** Send funds from loaded wallet to address.
  * If no `to` addres is provided, a random one is generated.
  * If a number from 1 to 255 is passed as address, a non-secret testing key is used. */
export function Send (amount: string|number|bigint, to?: string|number) {
  return Fn.Name(`Wallet sends ${amount} to ${to}`, async (context: Btc) => {
    context.identity = (typeof to === 'string') ? { p2wpkh: to } : createTestUser(context);
    context.txid = await context.rpc.sendtoaddress(context.identity.p2wpkh, String(100000));
    context.tx = await context.rest.tx(context.txid);
    await context.rpc.importaddress(context.identity.p2wpkh);
    await context.rpc.rescanblockchain();
  });
  function createTestUser ({ NETWORK, warn = console.warn, info = console.info }: Btc) {
    if (to === 0) throw new Error(`all zero test key not allowed`);
    const secret = (typeof to === 'number') ? new Uint8Array(Array(32).fill(to)) : randomBytes(32);
    const pubkey = pubECDSA(secret);
    const { address } = p2wpkh(pubkey, NETWORK);
    if (typeof to === 'number') {
      warn(`INSECURE, TESTING/EXAMPLE ONLY: Using non-secret key #${to}`);
    } else {
      info(`Generated random P2WPKH address ${address}`);
    }
    return { secret, pubkey, p2wpkh: address };
  }
}
