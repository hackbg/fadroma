#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import Btc from './btc.ts';
import Simf from './simf.ts';
import type { Async } from '../index.ts';
import { Test as The, Fn, Base16 } from '../index.ts';
import { equal, rejects } from '../deps.ts';
import { pubSchnorr, pubECDSA } from '@scure/btc-signer/utils.js';
import { p2wpkh } from '@scure/btc-signer';
const { is: Is, has: Has } = The;
/** Non-private key. */
const PRIVATE     = new Uint8Array(Array(32).fill(1));
/** Public key for Schnorr (witnesses). */
const PUB_SCHNORR = pubSchnorr(PRIVATE);
/** Public key for ECDSA (transactions). */
const PUB_ECDSA   = pubECDSA(PRIVATE);
/** 1 BTC = 100000000 Satoshis. */
const DECIMAL     = 100000000n;
/** Values for `initialfreecoins` and `initialreissuancetokens`. */
const INITIAL     = { COINS: 1000000n * DECIMAL, REISSUE: 1n * DECIMAL };
/** Asset ID for initial reissuance token. */
const REISSUE     = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
/** Asset ID for regular old Bitcoin. */
const BITCOIN     = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
/** Test the SimplicityHL support in Fadroma. */
export default The(import.meta, 'Simf',
  // Check that the API entrypoints are present on the WASM module:
  The('WASM', () => Simf.Wasm(),
    Has('cmr_to_p2tr', Is('function')),
    Has('compile',     Is('function'))),
  // Compile and deploy example programs:
  The('Deploy',
    () => Btc({ // Start by spawning a localnet:
      chain:                       'elementsregtest',
      acceptnonstdtxn:             true,
      anyonecanspendaremine:       true,
      bech32_hrp:                  'tex',
      blech32_hrp:                 'tlq',
      blindedprefix:               23,
      blindedaddresses:            true,
      con_blocksubsidy:            0,
      con_connect_genesis_outputs: true,
      con_elementsmode:            true,
      defaultpeggedassetname:      'bitcoin',
      discover:                    false,
      dnsseed:                     false,
      evbparams:                   'simplicity:-1:::',
      initialfreecoins:            INITIAL.COINS,
      initialreissuancetokens:     INITIAL.REISSUE,
      maxtxfee:                    100.0,
      persistmempool:              false,
      pubkeyprefix:                36,
      rest:                        true,
      rpcallowip:                  '127.0.0.1',
      rpcpassword:                 'fadroma',
      rpcport:                     8941,
      rpcuser:                     'fadroma',
      scriptprefix:                13,
      server:                      true,
      txindex:                     true,
      validatepegin:               false,
      vbparams:                    "taproot:1:1",
      //feeasset:                    BITCOIN,
      //subsidyasset:                BITCOIN,
    }),
    // Optionally, pipe the localnet's output to stderr:
    Btc.Verbose(false),
    // Create empty test wallet:
    Btc.CreateWallet('test-simf', testHasBalance({ bitcoin: 0 })),
    // Which, after rescan, turns out to not be empty:
    Btc.Rescan(testHasBalance({ bitcoin: Number(INITIAL.COINS / DECIMAL), [REISSUE]: 1 })),
    // And now we can test the included example programs:
    Example(true,  "unit program",       2.4e-7, 'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7', 'tex1p9jcvyzkdwdqtf49kta4xpc5g35xkfcexwfsl8v70w2gwttelncyshxjk56',
      'fn main () {}'),
    Example(true,  "assert true",        2.7e-7, '206e951b8c4e65032096bfa54ed287b804060f55db41d87edffcc566ab8728e8', 'tex1pa86g4lqqsll5p58qqjcauq0htfcgsvam6rv3ze2y07j8glg7smgska7ufk',
      'fn main () { assert!(true) }'),
    Example(false, "assert false",       2.7e-7, 'ec15fa538a70a3550cbc715ac1ee6efbeb4df2ef84abc37fd15b3981019ed88f', 'tex1pnjn54t0dd9d57n59vnuhvstfdnzcc72zl6dn4lgw0upc26ax0rnqp23aw0',
      'fn main () { assert!(false) }'),
    Example(true,  "basic jets work",    2.7e-7, 'e65e19e139a13583a0a7efb24be13c20d578f06f51b2a7fe7c7b9097072dbabe', 'tex1p305439usq06f4maelan8txnxshktvayu9z5gnwu6zrrxm9vmlufqcshcuv',
      `fn main () { let ab: u16 = <(u8, u8)>::into((0x10, 0x01));
                    let c:  u16 = 0x1001;
                    assert!(jet::eq_16(ab, c));
                    let ab: u8  = <(u4, u4)>::into((0b1011, 0b1101));
                    let c:  u8  = 0b10111101;
                    assert!(jet::eq_8(ab, c)); }`),
    Example(true,  "pay to pubkey",      2.7e-7, '0b771386a2ee6f0cfb296b0656a98431b77be650ea1eb0f7beb05894fe9bba87', 'tex1p53f33nnjed42the73v3y2hgdgmhq98fh3d5r05u23fjwc0xyp9fqzn6ulg',
      `fn main () { jet::bip_0340_verify((0x${Base16.encode(PUB_SCHNORR)}, jet::sig_all_hash()), witness::SIG) }`,
      ({ user }) => ({ SIG: Signature("0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"), })),
    Example(true,  "pay to pubkey hash", 2.7e-7, 'e65e19e139a13583a0a7efb24be13c20d578f06f51b2a7fe7c7b9097072dbabe', 'tex1p305439usq06f4maelan8txnxshktvayu9z5gnwu6zrrxm9vmlufqcshcuv',
      `fn main () { assert!(jet::eq_256(sha2(witness::PUB), 0x${Base16.encode(PUB_SCHNORR)}));
                    jet::bip_0340_verify((witness::PUB, jet::sig_all_hash()), witness::SIG) }
       fn sha2 (string: u256) -> u256 { let hasher: Ctx8 = jet::sha_256_ctx_8_init();
                                        let hasher: Ctx8 = jet::sha_256_ctx_8_add_32(hasher, string);
                                        jet::sha_256_ctx_8_finalize(hasher) }`,
      ({ user }) => ({ PUB: Signature("0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
                       SIG: Signature("0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"), })),
    // Shutdown the localnet.
    (btc: Btc) => btc.kill(9)));
/** Define signature field in witness data. */
function Signature (value: string) { return { type: "Signature", value } }
/** Define example program. */
function Example (
  /** Is the example expected to work? */
  pass: boolean,
  /** Human-readable identifier. */
  name: string,
  /** Expected deploy fee. */
  cost: number,
  /** Expected commitment Merkle root of program. */
  cmr: string,
  /** Expected pay-to-taproot address of program. */
  p2tr: string,
  /** Source code of program. */
  src: string,
  /** Function that provides witness data. */
  witness?: Fn<[object], Async<object>>
) {
  const fail = !pass
  return Fn.Name(`${name} (${p2tr||'unspecified P2TR'})`, testExample, { name, cost, cmr, p2tr, src, fail: !pass, witness })
  async function testExample (context: Btc) {
    const { compile } = await Simf.Wasm();
    const result = compile(src, {}) as { toJSON: Fn.Returns<{ cmr: unknown }> };
    if (cmr) equal(result.toJSON().cmr, cmr);
    if (p2tr) equal(result.toJSON().p2tr, p2tr);
    if (p2tr) equal(result.toString(), p2tr);
    const { rpc, rest } = context;
    // Fund program from deployer
    const id = await rpc.sendtoaddress(p2tr, String(1));
    const tx = testSplitTx(await rest.tx(id), p2tr, 1, cost).hex;
    // Make spender wallet available in local RPC:
    const net  = { bech32: 'tex', pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef, };
    const user = p2wpkh(PUB_ECDSA, net).address;
    await rpc.importaddress(user);
    const prog = await Simf(src).compile();
    const wits = witness ? await witness({ user }) : {};
    //await rpc.sendtoaddress(user, 1);
    //equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: 1 });
    // Spend from program:
    const fee    = 1e-4;
    const amount = 1. - fee;
    await rpc.rescanblockchain();
    const balance = ((await rpc.getreceivedbyaddress(user, 0)) as { bitcoin: number }).bitcoin;
    if (fail) {
      rejects(()=>prog.spend({ rpc, rest, tx, amount, fee, witness: wits, to: user }));
      equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: balance });
    } else {
      const sent = await prog.spend({ rpc, rest, tx, amount, fee, witness: wits, to: user });
      equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: balance + amount });
    }
    return context;
  }
}
/** Define test case for expected wallet balance. */
function testHasBalance <T> (balance: T) {
  return Fn.Name(`Balance is ${balance}`, (info: { balance: T }) => equal(info.balance, balance))
}
function testSplitTx (
  tx: { hex: unknown, vout: unknown[] }, p2tr: string, amount: number, cost: number, _remaining?: number
) {
  equal(tx.vout.length, 3);
  const hasVout   = (f: Fn, t: string) => equal(tx.vout.filter(f).length, 1, `post deploy: ${t}`);
  const isBalance = (x: Btc.Vout)=>((x.value===amount) && (x.scriptPubKey.address == p2tr));
  const isFee     = (x: Btc.Vout)=>x.value===cost;
  hasVout(isBalance, `balance: program ${p2tr} must receive ${amount}`);
  hasVout(isFee,     `fee: deploy fee must be ${cost}`);
  //hasVout((x: Btc.Vout)=>x.value===bitcoin, `remaining: must be ${bitcoin}`);
  return tx
}
///** Asset ID for regular old Bitcoin. */
//const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
///** Asset IDs of (t)L-BTC. */
//const LIQUID  = { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
//               , testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' };
    //The('Examples',
      //// If examples were not overridden, initialize default examples with test constants:
      //Fn.Name('Provide test constants', async (btc: Btc) => {
        //const address = await btc.rpc.getnewaddress(`fadroma-test`, "bech32");
        //const { pubkey } = await btc.rpc.getaddressinfo(address);
        //examples ||= Example({ pubkey: pubkey.slice(2) });
        //return btc
      //}),
      //// Test funding and spending each example:
      //Fn.Name('Fund and spend', async (btc: Btc, context: Test.Testing) => {
        //const testCase = The('Example', ...examples.map(testFundAndSpend));
        //await testCase(btc, context);
        //return btc;
      //})
    //),
  // TODO:
  /* https://github.com/BlockstreamResearch/SimplicityHL/blob/master/examples/escrow_with_delay.simf
   * https://docs.ivylang.org/bitcoin/language/ExampleContracts.html#escrowwithdelay */
  //function EscrowProgram ({
    //sender    = '0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    //recipient = '0xc6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    //escrow    = '0xf9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9',
    //timeout   = '1000',
  //} = {}) { return `
    //fn main () {
      //// Depending on provided witness:
      //match witness::TRANSFER_OR_TIMEOUT {
        //// Transfer to receiver:
        //Left(maybe_sigs: [Option<Signature>; 3]) => spend_confirm(maybe_sigs),
        //// or return to sender:
        //Right(sender_sig: Signature) => spend_revoke(sender_sig), } }
    //fn spend_revoke (sender_sig: Signature) {
      //checksig(${sender}, sender_sig);
      //jet::check_lock_distance(${timeout}); }
    //fn spend_confirm (maybe_sigs: [Option<Signature>; 3]) {
      //let threshold: u8 = 2;
      //let [sig1, sig2, sig3]: [Option<Signature>; 3] = maybe_sigs;
      //let counter1: u8 = checksig_add(0,        ${sender},    sig1);
      //let counter2: u8 = checksig_add(counter1, ${recipient}, sig2);
      //let counter3: u8 = checksig_add(counter2, ${escrow},    sig3);
      //assert!(jet::eq_8(counter3, threshold)); }
    //fn checksig_add (counter: u8, pk: Pubkey, maybe_sig: Option<Signature>) -> u8 {
      //match maybe_sig {
        //None => counter,
        //Some(sig: Signature) => {
          //checksig(pk, sig);
          //let (carry, new_counter): (bool, u8) = jet::increment_8(counter);
          //assert!(not(carry));
          //new_counter } } }
    //fn checksig (pk: Pubkey, sig: Signature) {
      //jet::bip_0340_verify((pk, jet::sig_all_hash()), sig); }
    //fn not (bit: bool) -> bool {
      //<u1>::into(jet::complement_1(<bool>::into(bit))) }
  //` }
  //function EscrowProgramWitness (
    //value = "Right(0xedb6865094260f8558728233aae017dd0969a2afe5f08c282e1ab659bf2462684c99a64a2a57246358a0d632671778d016e6df7381293dd5bb9f0999d38640d4)",
  //) { return { TRANSFER_OR_TIMEOUT: Either('[Option<Signature>; 3]', 'Signature', value) } }

  //[>* Test cmr_to_p2tr on a given example. <]
  //function testAddress ({ cmr, p2tr: expectedP2TR }: Example) {
    //return (cmrToP2TR: Fn) => {
      //throws(()=>cmrToP2TR());
      //if (cmr) {
        //const p2tr = cmrToP2TR(cmr);
        //if (expectedP2TR) equal(p2tr, expectedP2TR);
      //}
      //return cmrToP2TR
    //}
  //}

  //[>* Test compile on a given example. <]
  //function testCompile ({ src, cmr }: Example) {
    //return Fn.Name(`Compile (${src.length}b)`, (compile: Fn) => {
      //const result = compile(src, {}) as { toJSON: Fn.Returns<{ cmr: unknown }> };
      //if (cmr) equal(result.toJSON().cmr, cmr);
      //return compile;
    //});
  //}
