import Html from '../library/Html.ts';
import { Base16 } from '../library/Number.ts';
import { Wasm } from '../platform/SimplicityHL/SimplicityHL.ts';
import { pubECDSA } from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?
import { p2wpkh as P2WPKH }   from 'npm:@scure/btc-signer';

const { keypair, compiler } = await Wasm(
  new URL('/wasm/fadroma_simf_bg.wasm', location.href),
  new URL('/wasm/fadroma_simf.js',      location.href),
);

console.log({keypair, compiler});

export default Demo;

const nonSecret = (n: number) => new Uint8Array(new Array(32).fill(n));

function Demo ({
  root  = document.getElementById('demousers'),
  users = { Alice: User('Alice', { secret: nonSecret(1) })
          , Bob:   User('Bob',   { secret: nonSecret(2) })
          , Carol: User('Carol', { secret: nonSecret(3) }) }
} = {}) {
  for (const user of Object.values(users)) root.appendChild(Html(user));
  return Object.assign(root, { users });
}

export function User (name: string, {
  secret   = new Uint8Array(Array(32).fill(1)),
  signer   = keypair(secret),
  pubkey   = pubECDSA(secret),
  pubkeyX  = signer.xOnlyPublicKey(),
  chain    = { bech32: 'ert', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, },
  p2wpkh   = P2WPKH(pubkey, chain).address,
  logger   = Html(['div.demolog', 'Enter Bob, Carol.']),
  balance  = '1.00000000 tLBTC',
  toolbar  = Html(['section.demoprogs', ['button.pill', 'Send'], ['button.pill', 'P2PK'], ['button.pill', 'Vault'], ['button.pill', 'Escrow'], ['input.chat', { placeholder: 'chat' }], ['button.pill', 'Say']]),
  identity = Html(['section.demometa', ['div.col.gap', ['div.row.gap.align-center', ['strong.demoname', name], ['strong', balance]]]])
} = {}) {
  return ['div.col.align-center',
    ['article.demouser', identity, logger, toolbar],
    ['div.col.gap',
      ['div.col', ['strong', 'Address:'], ['div.address', p2wpkh]],
      //['div.col', ['strong', 'Pubkey:'],  ['div.address', Base16.encode(pubkey)]],
      //['div.col', ['strong', 'Tweaked:'], ['div.address', Base16.encode(pubkeyX)]],
    ]]
}
