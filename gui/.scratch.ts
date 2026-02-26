/** Wrap a SimplicityHL program as a standalone Deno executable. */
//function SimfTS (source: string) {
  //return `#!/usr/bin/env -S deno run -P default\nimport { SimplicityHL } from 'fadroma';\n` +
    //`export default await SimplicityHL.Program(\`${source}\`).cli(import.meta)`;
//}
  //export const Hex = (id: string, ...content: unknown[]) =>
    //Html([`div.field.file.hex#${id}`,
      //['div.handle-v', { onclick: Field.toggle(id) },
        //['svg.icon.expanded', ['use[href=icons.svg#chevron-down]']],
        //['div.grow']],
      //['div.flex.col.grow',
        //['div.flex.row',
          //['div.name',     { onclick: Field.toggle(id) }, id],
          //['div.handle-h', { onclick: Field.toggle(id) }]],
        //HexRow('00000000 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000010 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000020 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................'),
        //HexRow('00000030 ', '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ', '................')]]);

  //export const HexRow = (addr, bytes, chars) => ['div.row.hex-row', addr, bytes, chars];

//}

//export function Program (id: string, ...content: string[]) {
  //return Field(id)
    //.header(Button.Command('play', 'Compile', { onclick: e => Program.recompile(id, e) }))
    //.header(Button.Command('circle-with-plus', 'Define'))
    //.content(Field.TextArea(id, ...content))
    //.content([`div.row#result:${id}`, ['div.grow']])
    //.content([`div.row.simf-result`, ['strong', `P2TR: `],
      //[`div.grow#commit:${id}`, `(not compiled)`],
      //['a.help', { target: 'blank', title: 'Address of program', href: "#" }, Icon('help')]])
    //.content([`div.row.simf-result`, ['strong.w', `Sighash: `],
        //[`div.grow#cmr:${id}`, `(not generated)`],
        //['a.help', { target: 'blank', title: 'Witness signing hash', href: "#" }, Icon('help')]])
    //.sidebar(['div.col.simf-sidebar', 'Sidebar'])
    //.build();
//}
  //export const OracleForm = () => Witness("oracle.wit", 
    //WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
    //WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
    //WitnessRow('sig', 'ORACLE_SIG',    ''),
    //WitnessRow('sig', 'OWNER_SIG',     ''));

  //export const OracleTS = ({ deno, node }) => ES("oracle.ts",
    //ES.HashBang({ deno, node }),
    //ES.Import("@hackbg/fadroma", simf && 'Simf'),
    //simf && `export default Simf(import.meta, "src/main.simf");`);

  //export const Witness = (id: string, ...content: unknown[]) => Field(id).open(false)
    //.header(['select', ['option', 'src/main.simf']])
    //.header(Button.Command('play', 'Satisfy', { onclick: e => recompileSimplictyHL(id, e) }))
    //.content([['div.col.collapsible',
      //WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
      //WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
      //WitnessRow('sig', 'ORACLE_SIG',    ''),
      //WitnessRow('sig', 'OWNER_SIG',     ''),
      //['div.row', ['div.grow'], Button.Command('circle-with-plus', 'Witness')]]])
    //.build();

  //export const WitnessRow = (t: 'sig'|'u32', k: string, v: string|Bytes) =>
    //['div.witness',
      //['input[type=text].grow', { value: k, placeholder: 'name' }],
      //['label', ['select', ['option', { value: t }, t]]],
      //['label.row', ['input[type=text].grow', { value: v, placeholder: 'value' }]],
      //Button.Command('circle-with-cross', 'Remove')];

  //export const SimfFn = (name: string, ...content: unknown[]) =>
    //['div.col.fn',
      //['div.row.align-center',
        //['strong.keyword', 'fn '],
        //[`input[type=text][size=${name.length-2}]`, { value: name }],
        //'(', [`input[type=text][size=2]`], ')',
        //' { ',
        //['div.grow'],
        //Button.Command('circle-with-cross', 'Remove')],
      //['textarea', content.join('\n')||' '], '}'];


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

