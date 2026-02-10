#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Test as The, Base16 } from '../index.ts';
import Btc from './btc.ts';
import { p2pkh, p2wpkh } from '@scure/btc-signer';
import { pubSchnorr, pubECDSA } from '@scure/btc-signer/utils.js';
import { equal } from 'node:assert';
const priv = new Uint8Array(Array(32).fill(1));
export default The(import.meta, 'Btc',
  The('Address',
    The('Schnorr', () => equal(Base16.encode(pubSchnorr(priv)), '1B84C5567B126440995D3ED5AABA0565D71E1834604819FF9C17F5E9D5DD078F')),
    The('ECDSA',   () => equal(Base16.encode(pubECDSA(priv)),   '031B84C5567B126440995D3ED5AABA0565D71E1834604819FF9C17F5E9D5DD078F')),
    The('P2PKH',   () => equal(p2pkh(pubECDSA(priv)).address,   '1C6Rc3w25VHud3dLDamutaqfKWqhrLRTaD')),
    The('P2WPKH',  () => equal(p2wpkh(pubECDSA(priv)).address,  'bc1q0xcqpzrky6eff2g52qdye53xkk9jxkvrh6yhyw'))),
  The('Node', Btc, (btc: Btc) => btc.kill()),
  The('Ops',
    The('Send', 'OP_CHECKSIG'),
    The('Subscribe', 'TX', 'Block'),
    The('Query', 'Block', 'Transaction', 'Address')));
