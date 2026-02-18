import { Fields } from './Field.ts';
export default Simf;
function Simf () {}
namespace Simf {

  export const HodlVault = () => Fields.Simf("vault.simf", `/** HODL VAULT: Lock your coins until the Bitcoin price exceeds a threshold.
 * - Oracle signs message with current block height and current Bitcoin price.
 * - Block height compared with a minimum height to prevent use of old data.
 * - TX is timelocked to oracle height, so it only becomes valid after the oracle height. */

fn checksigfromstack (pk: Pubkey, bytes: [u32; 2], sig: Signature) {
    let [word1, word2]: [u32; 2] = bytes;
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
}

fn main () {
    let oracle_height: Height = witness::ORACLE_HEIGHT;
    jet::check_lock_height(oracle_height);

    let min_height: Height = param::MIN_HEIGHT;
    assert!(jet::le_32(min_height, oracle_height));

    let oracle_price: u32 = witness::ORACLE_PRICE;
    let target_price: u32 = param::TARGET_PRICE;
    assert!(jet::le_32(target_price, oracle_price));

    checksigfromstack(param::ORACLE, [oracle_height, oracle_price], witness::ORACLE);
    let [word1, word2]: [u32; 2] = bytes;
    let hasher: Ctx8 = jet::sha_256_ctx_8_init();
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_height);
    let hasher: Ctx8 = jet::sha_256_ctx_8_add_4(hasher, oracle_price);
    let msg: u256 = jet::sha_256_ctx_8_finalize(hasher);
    jet::bip_0340_verify((param::ORACLE, msg), witness::ORACLE);
    jet::bip_0340_verify((param::OWNER, jet::sig_all_hash()), witness:OWNER);
}`)

  export const P2PKTS = () =>
    Fields.TS("P2PK.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';
export default await SimplicityHL(\`fn main () {
  jet::bip_0340_verify((param::PK, jet::sig_all_hash()), witness::SIG)
}\`);`);

  export const P2PKHTS = () =>
    Fields.TS("P2PKH.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';
export default await SimplicityHL(\`fn main () {
  let hasher: Ctx8 = jet::sha_256_ctx_8_init();
  let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, witness::PUB);
  let hash:   u256 = jet::sha_256_ctx_8_finalize(hasher)
  assert!(jet::eq_256(hash, param::PKH));
  jet::bip_0340_verify((witness::PUB, jet::sig_all_hash()), witness::SIG)
}\`);`);

  export const EscrowTS = () =>
    Fields.TS("Escrow.simf.ts", `#!/usr/bin/env -S deno run
import SimplcityHL from 'fadroma/simf';`);

  export const HodlVaultTS = () => Fields.TS("Vault.simf.ts", `import SimplcityHL from 'fadroma/simf';
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

  export const OracleForm = () => Fields.Witness("oracle.wit", 
            Fields.WitnessRow('u32', 'ORACLE_HEIGHT', '1000'),
            Fields.WitnessRow('u32', 'ORACLE_PRICE',  '100000'),
            Fields.WitnessRow('sig', 'ORACLE_SIG',    ''),
            Fields.WitnessRow('sig', 'OWNER_SIG',     ''));

  export const OracleTS = () => Fields.TS("oracle.ts",
            ES.HashBang({ deno, node }),
            ES.Import("@hackbg/fadroma", simf && 'Simf'),
            simf && `export default Simf(import.meta, "src/main.simf");`);

}
