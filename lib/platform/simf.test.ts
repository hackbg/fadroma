#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Fn, Test, Name } from '../index.ts';
import { equal, throws, stderr } from '../deps.ts';
import { Simf } from './simf.ts';
import { Btc } from './btc.ts';
const { the, is, has } = Test;
/** Asset ID for regular old Bitcoin. */
const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
/** Asset ID for initial reissuance token. */
const REISSUE = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
/** Asset IDs of (t)L-BTC. */
const LIQUID  = { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
                , testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' };
/** 1 BTC = 100000000 Satoshis. */
const DECIMAL = 100000000n;
/** Values for `initialfreecoins` and `initialreissuancetokens`. */
const INITIAL = { COINS: 1000000n * DECIMAL, REISSUE: 1n * DECIMAL };
/** Predefined example program. */
type Example = { cmr?: string, p2tr?: string, src: string };
/** Test the Simplicity support. */
export default Test.suite(import.meta, 'Simf', testWasm(), testDeploy())
/** Test the top-level functions of the WASM module. */
function testWasm (examples = [
  exampleEmpty(),
  exampleProgram(),
]) {
  return the('WASM', Simf.Wasm,
    has('default',     is('function')),
    has('cmr_to_p2tr', is('function'), ...examples.map(testAddress)),
    has('compile',     is('function'), ...examples.map(testCompile)),
  );
}
function testCompile ({ src, cmr }: Example) {
  return Name(`testCompile ${src.length}b`, (compile: Fn, _context) => {
    const result = compile(src, {}) as { toJSON (): { cmr: string }, spend (): object };
    if (cmr) equal(result.toJSON().cmr, cmr);
    equal(typeof result.spend, 'function');
    return compile;
  });
}
function testAddress ({ cmr, p2tr: expectedP2TR }: Example) {
  return (cmrToP2TR: Fn) => {
    throws(()=>cmrToP2TR());
    const p2tr = cmrToP2TR(cmr);
    if (expectedP2TR) equal(p2tr, expectedP2TR);
    return cmrToP2TR
  }
}
/** Test deploying a simplicity program. */
function testDeploy (examples = [
  exampleEmpty(),
  exampleProgram(),
]) {
  let bitcoin = Number(INITIAL.COINS / DECIMAL);
  return the('Deploy', () => Btc(daemonOptions()),
    Log(false), // Pipe daemon output to stderr
    Wait(1000),
    Create('test-simf', hasBalance({ "bitcoin": 0 })),
    Rescan(hasBalance({ bitcoin, [REISSUE]: 1 })),
    ...examples.map(example=>Deploy(example.p2tr, ({ chainHeight, utxos })=>{
      equal(utxos.length, 2);
      equal(utxos[0].height, chainHeight);
      equal(utxos[1].height, chainHeight);
      // utxos come in either order:
      type UTXO = { value: number };
      equal(utxos.filter((x: UTXO)=>x.value===1000).length, 1);
      equal(utxos.filter((x: UTXO)=>x.value===998999.99999976).length, 1);
    }),
    Spend(exampleEmpty().src)));
}
function Create (name: string, cb?: Fn) {
  return Name(`Create ${name}`, async (ctx: { rpc, rest }) => {
    await ctx.rpc.createwallet(name);
    cb && await cb(await ctx.rpc.getwalletinfo());
    return ctx
  })
};
function Rescan (cb?: Fn) {
  return Name(`Rescan`, async (ctx: { rpc, rest }) => {
    await ctx.rpc.rescanblockchain();
    await cb(await ctx.rpc.getwalletinfo());
    return ctx
  })
};
function Deploy (p2tr: string, _cb?: Fn) {
  return Name(p2tr, async (ctx: Btc) => {
    const user  = await ctx.rpc.getnewaddress("fadroma", "bech32");
    const txId  = await ctx.rpc.sendtoaddress(p2tr, 1000);
    await ctx.rpc.generatetoaddress(1, user);
    const tx    = await ctx.rest.tx(txId) as { blockhash: string };
    const block = await ctx.rest.block(tx.blockhash);
    return Object.assign(ctx, { user, block, tx });
  })
}
function Spend (source: string, _cb?: Fn) {
  return Name('Spend', async ({ rpc, rest, user, tx, block }, { log }) => {
    const destination = user;//await rpc.getnewaddress();
    const program = await Simf(source).compile();
    const { txid: txId, hex: txBytes } = tx;
    const spend = program.spend({ witness: '', destination, txId, txBytes, });
    equal(spend.bytes.length,  240);
    equal(spend.hex.length,    480);
    equal(spend.decoded.version, 2);
    equal(spend.decoded.input.length,    1);
    equal(spend.decoded.input[0].previous_output.txid, txId);
    equal(spend.decoded.output.length,   2);
    equal(spend.decoded.output[0].value, '99999999000');
    equal(spend.decoded.output[1].value, '1000');
    const sent = await rpc.sendrawtransaction(spend.hex);
    //const signed = await rpc.signrawtransactionwithkey(spend.hex);
  })
}
function hasBalance (balance) {
  return info => equal(info.balance, balance)
}
function examples () {
  return [exampleEmpty(), exampleProgram()]
}
function exampleEmpty () {
  return {
    cmr: 'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7',
    p2tr: 'tex1p9jcvyzkdwdqtf49kta4xpc5g35xkfcexwfsl8v70w2gwttelncyshxjk56',
    src: 'fn main () {}',
  }
}
function exampleProgram () {
  return {
    cmr: 'e65e19e139a13583a0a7efb24be13c20d578f06f51b2a7fe7c7b9097072dbabe',
    p2tr: 'tex1p305439usq06f4maelan8txnxshktvayu9z5gnwu6zrrxm9vmlufqcshcuv',
    src: `fn main() {
      let ab: u16 = <(u8, u8)>::into((0x10, 0x01));
      let c: u16 = 0x1001;
      assert!(jet::eq_16(ab, c));
      let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));
      let c: u8 = 0b10111101;
      assert!(jet::eq_8(ab, c));
    }`,
  }
}
function exampleP2PK (
  pubkey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
) {
  return {
    src: `fn main() {
      let pk: Pubkey = 0x${pubkey};
      let msg: u256 = jet::sig_all_hash();
      let sig: Signature = witness::signature;
      jet::bip_0340_verify(pk, msg, sig)
    }`
  }
}
function daemonOptions (): Btc.Options {
  return {
    anyonecanspendaremine:       true,
    bech32_hrp:                  'tex',
    blech32_hrp:                 'tlq',
    blindedprefix:               23,
    blindedaddresses:            true,
    con_blocksubsidy:            0,
    con_connect_genesis_outputs: true,
    chain:                       'elementsregtest',
    defaultpeggedassetname:      'bitcoin',
    discover:                    false,
    dnsseed:                     false,
    //feeasset:                    'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23',
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
    //subsidyasset:                'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23',
    txindex:                     true,
    validatepegin:               false,
    vbparams:                    "taproot:1:1",
  } as const;
}
function Log (on) {
  return Name(`Log: ${on}`, (ctx) => {
    if (on) {
      ctx.stdout.pipe(stderr);
      ctx.stderr.pipe(stderr);
    }
    return ctx
  })
};
function Wait (time: number) {
  return Name(`Wait ${time}ms`, async (ctx: unknown) => {
    await new Promise(resolve=>setTimeout(resolve, time));
    return ctx
  })
};
