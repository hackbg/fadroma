import Html from '../library/Html.ts';
import { Wasm } from '../platform/SimplicityHL/SimplicityHL.ts';
import { pubECDSA } from 'npm:@scure/btc-signer/utils.js'; // not already in keypair?

const { keypair, compiler } = await Wasm(
  new URL('/wasm/fadroma_simf_bg.wasm', location.href),
  new URL('/wasm/fadroma_simf.js',      location.href),
);

console.log({keypair, compiler});

export default Demo;

async function Demo ({
  root  = document.getElementById('demousers'),
  users = {
    Alice: Demo.User('Alice'),
    Bob:   Demo.User('Bob'),
    Carol: Demo.User('Carol'),
  }
} = {}) {
  for (const user of Object.values(users)) root.appendChild(Html(await user));
  return Object.assign(root, { users });
}

namespace Demo {

  export async function User (name: string, {
    secret  = new Uint8Array(Array(32).fill(1)),
    keypair = SimplicityHL.Keypair(secret),
    pubkey  = pubECDSA(secret),
  } = {}) {
    keypair = await keypair;
    console.log({ name, pubkey });
    return ['article.demouser',
      ['section.demometa', ['strong.demoname', name], ['strong', '1.00000000 tLBTC'], 'at tex1p9sv7g8tyljjymz4t6zyjpvepw4...'],
      ['div.demolog', 'Enter Bob, Carol.'],
      ['section.demoprogs',
        ['button.pill', 'Send'],
        ['button.pill', 'P2PK'],
        ['button.pill', 'Vault'],
        ['button.pill', 'Escrow'],
        ['input', { placeholder: 'chat' }],
        ['button.pill', 'Say']]]
  }

}
