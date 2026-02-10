#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1
import { Test as The } from '../index.ts';
import Btc from './btc.ts';
import { p2pkh, p2wpkh } from '@scure/btc-signer';
import { pubSchnorr, pubECDSA } from '@scure/btc-signer/utils.js';
export default The(import.meta, 'Btc',
  The('Address', () => {
    const priv = new Uint8Array(Array(32).fill(1));
    const pubS = pubSchnorr(priv);
    const pubE = pubECDSA(priv);
    const pkh  = p2pkh(pubE);
    const wpkh = p2wpkh(pubE);
  }),
  The('Node', Btc, (btc: Btc) => btc.kill()),
  The('Ops',
    The('Send', 'OP_CHECKSIG'),
    The('Subscribe', 'TX', 'Block'),
    The('Query', 'Block', 'Transaction', 'Address')));
