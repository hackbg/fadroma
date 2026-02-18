import ES from './ES.ts';
import Field from './Field.ts';
import Command from './Command.ts';
import { Icon, elById } from '../lib.ts';
export default Simf;
function Simf (id: string, ...content: string[]) {
  return Field({
    id,
    header: [
      Command('play', 'Compile', { onclick: simfCompile(id) }),
      //Command('circle-with-plus', 'Define')
    ],
    content: [
      Field.TextArea(id, ...content),
      [`div.row#result:${id}`, ['div.grow']],
      [`div.row.simf-result`, ['strong', `P2TR: `],
        [`div.grow#commit:${id}`, `(not compiled)`],
        ['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]],
      [`div.row.simf-result`, ['strong.w', `Sighash: `],
        [`div.grow#cmr:${id}`, `(not generated)`],
        ['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]],
    ] })
}
namespace Simf {

  export const P2PKTS = () =>
    ['div.row.grow', ES("P2PK.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';
export default await SimplicityHL(\`fn main () {
  jet::bip_0340_verify((param::PK, jet::sig_all_hash()), witness::SIG)
}\`);`), ['div.col', 'Params', 'Witness']];

  export const P2PKHTS = () =>
    ES("P2PKH.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';
export default await SimplicityHL(\`fn main () {
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, witness::PUB);
  let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher)
  assert!(jet::eq_256(hash, param::PKH));
  jet::bip_0340_verify((witness::PUB, jet::sig_all_hash()), witness::SIG)
}\`);`);

  export const EscrowTS = () =>
    ES("Escrow.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';`);

  export const HodlVaultTS = () => ES("Vault.simf.ts", `import SimplcityHL from 'fadroma/simf';
export default await SimplicityHL(\`fn main () {
  let min_height: Height = param::MIN_HEIGHT;
  let target_price: u32 = param::TARGET_PRICE;
  let oracle_price: u32 = witness::ORACLE_PRICE;
  let oracle_height: Height = witness::ORACLE_HEIGHT;
  jet::check_lock_height(oracle_height);
  assert!(jet::le_32(min_height, oracle_height));
  assert!(jet::le_32(target_price, oracle_price));
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
  let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
  jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
  jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness:OWNER);
}\`)`);

  export const OracleForm = () => Field.Witness("oracle.wit", 
            Field.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
            Field.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
            Field.WitnessRow('sig', 'ORACLE_SIG',    ''),
            Field.WitnessRow('sig', 'OWNER_SIG',     ''));

  export const OracleTS = () => ES("oracle.ts",
            ES.HashBang({ deno, node }),
            ES.Import("@hackbg/fadroma", simf && 'Simf'),
            simf && `export default Simf(import.meta, "src/main.simf");`);

  let simf = null
  function simfCompile (id) {
    return async e => {
      simf ??= await import('../../platform/SimplicityHL/pkg/fadroma_simf.js')
      console.log(e.target)
      const resp = await fetch('/wasm/simf.wasm');
      const wasm = await resp.bytes();
      console.log({simf, resp, wasm});
      console.log(await simf.default(wasm));
      const result = simf.build('fn main () {}', {});
      console.log({result});
      elById(`result:${id}`).style.whiteSpace = 'pre';
      elById(`commit:${id}`).innerText = result.commit;
      elById(`cmr:${id}`).innerText = result.cmr;
      elById(`amr:${id}`).innerText = result.amr;
      elById(`ihr:${id}`).innerText = result.ihr;
    }
  }

  export const SimfFn = (name: string, ...content: unknown[]) =>
    ['div.col.fn',
      ['div.row.align-center',
        ['strong.keyword', 'fn '],
        [`input[type=text][size=${name.length-2}]`, { value: name }],
        '(', [`input[type=text][size=2]`], ')',
        ' { ',
        ['div.grow'],
        Command('circle-with-cross', 'Remove')],
      ['textarea', content.join('\n')||' '], '}'];

  export const Witness = (id: string, ...content: unknown[]) => Field({
    id, collapsed: true, header: [
      ['select', ['option', 'src/main.simf']],
      Command('play', 'Satisfy', { onclick: simfCompile(id) }),
    ], content: [['div.col.collapsible',
      WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      WitnessRow('sig', 'ORACLE_SIG',    ''),
      WitnessRow('sig', 'OWNER_SIG',     ''),
      ['div.row', ['div.grow'], Command('circle-with-plus', 'Witness')]]] });

  export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    ['div.witness',
      ['input[type=text].grow', { value: k, placeholder: 'name' }],
      ['label', ['select', ['option', { value: t }, t]]],
      ['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      Command('circle-with-cross', 'Remove')];

}

  //export const HodlVault = () => Simf("vault.simf", `[>* HODL VAULT: Lock your coins until the Bitcoin price exceeds a threshold.
 //* - Oracle signs message with current block height and current Bitcoin price.
 //* - Block height compared with a minimum height to prevent use of old data.
 //* - TX is timelocked to oracle height, so it only becomes valid after the oracle height. */

//fn checksigfromstack (pk: Pubkey, bytes: [u32; 2], sig: Signature) {
    //let [word1, word2]: [u32; 2] = bytes;
    //let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    //let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    //jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
//}

//fn main () {
    //let oracle_height: Height = witness::ORACLE_HEIGHT;
    //jet::check_lock_height(oracle_height);

    //let min_height: Height = param::MIN_HEIGHT;
    //assert!(jet::le_32(min_height, oracle_height));

    //let oracle_price: u32 = witness::ORACLE_PRICE;
    //let target_price: u32 = param::TARGET_PRICE;
    //assert!(jet::le_32(target_price, oracle_price));

    //checksigfromstack(param::ORACLE, [oracle_height, oracle_price], witness::ORACLE);
    //let [word1, word2]: [u32; 2] = bytes;
    //let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    //let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    //let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    //jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
    //jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness:OWNER);
//}`)
