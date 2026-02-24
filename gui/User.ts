import Html from '../library/Html.ts';
import { Base16 } from '../library/Number.ts';
import { p2wpkh as P2WPKH } from 'npm:@scure/btc-signer';
import { pubECDSA } from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import Wasm from './Wasm.ts';

const nonSecret = (n: number) => new Uint8Array(new Array(32).fill(n));

export const USERS = {};

export default function Users () {
  const users = document.getElementById('demousers');
  const [alice, bob, carol] = [
    addUser('Alice', { secret: nonSecret(1) }),
    addUser('Bob',   { secret: nonSecret(2) }),
    addUser('Carol', { secret: nonSecret(3) }),
  ];
  for (const user of [alice, bob, carol]) {
    Html.append(users, user.view());
  }
  for (const select of document.querySelectorAll('select.pick-user')) {
    select.innerHTML = '';
    for (const user of [alice, bob, carol]) {
      const label = `${user.name} (${user.p2wpkh.slice(0, 10)}...)`
      select.appendChild(Html(['option', { value: user.pubkey }, label]));
    }
  }
}

export function addUser (name, options) {
  if (USERS[name]) throw new Error(`user already exists: ${name}`);
  return USERS[name] = User(name, options);
}

export function User (name: string, {
  secret   = new Uint8Array(Array(32).fill(1)),
  signer   = Wasm.keypair(secret),
  pubkey   = pubECDSA(secret),
  pubkeyX  = signer.xOnlyPublicKey(),
  chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
  p2wpkh   = P2WPKH(pubkey, chain).address,
  output   = Html(['div.demolog', 'Enter Bob, Carol.']),
  //p2p      = P2P({ name, root: output }),
  balance  = '1.00000000 tLBTC',
  toolbar  = Html(['section.demoprogs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
  identity = Html(['section.demometa', ['div.col.gap', ['div.row.gap.align-center', ['strong.demoname', name], ['strong', balance]]]]),
} = {}) {
  return {
    name,
    signer,
    pubkey,
    pubkeyX,
    p2wpkh,
    view: () => Html(['div.col.align-center',
      ['article.demouser', identity, output, toolbar],
      ['div.col.gap', ['div.col', ['strong', 'Address:'], ['div.address', p2wpkh]]]])
        //['div.col', ['strong', 'Pubkey:'],  ['div.address', Base16.encode(pubkey)]],
        //['div.col', ['strong', 'Tweaked:'], ['div.address', Base16.encode(pubkeyX)]],
  }
}
