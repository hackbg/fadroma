

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

