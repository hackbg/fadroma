#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Fn, Test, Name } from '../index.ts';
import { resolvePath, equal, throws, stdout } from '../deps.ts';
import { Simf } from './simf.ts';
import { Btc } from './btc.ts';
const { the, is, has } = Test;

export const fixtures = {

  unit: {
    cmr: 'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7',
    p2tr: 'tex1p9jcvyzkdwdqtf49kta4xpc5g35xkfcexwfsl8v70w2gwttelncyshxjk56',
    src: 'fn main () {}',
  },

  example1: {
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
  },

  exampleP2PK: (
    pubkey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  ) => {
    return `fn main() {
      let pk: Pubkey = 0x${pubkey};
      let msg: u256 = jet::sig_all_hash();
      let sig: Signature = witness::signature;
      jet::bip_0340_verify(pk, msg, sig)
    }`
  },

  bitcoin:    'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23',
  reissuance: 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61',
  liquidBitcoin: {
    mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d',
    testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49',
  }

};

const daemonOptions: Btc.Options = {
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
  initialfreecoins:            1_000_000_00000000,
  initialreissuancetokens:     1_00000000,
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

export default Test.suite(import.meta, 'Simf',

  the('WASM', Simf.Wasm,
    has('default', is('function')),
    has('compile', is('function'),
      ExpectSourceCmr(fixtures.unit.src, fixtures.unit.cmr),
      ExpectSourceCmr(fixtures.example1.src, fixtures.example1.cmr)),
    has('cmr_to_p2tr', is('function'),
      ExpectCmrP2tr(fixtures.unit.cmr, fixtures.unit.p2tr),
      ExpectCmrP2tr(fixtures.example1.cmr, fixtures.example1.p2tr))),

  the('Deploy', () => Btc(daemonOptions),
    Log(false),
    Wait(1000),
    Create('test-simf', hasBalance({ bitcoin: 0 })),
    Rescan(hasBalance({ bitcoin: 1000000, [fixtures.reissuance]: 1 })),
    Deploy(fixtures.unit.p2tr, ({ chainHeight, utxos })=>{
      equal(utxos.length, 2);
      equal(utxos[0].height, chainHeight);
      equal(utxos[1].height, chainHeight);
      // utxos come in either order:
      type UTXO = { value: number };
      equal(utxos.filter((x: UTXO)=>x.value===1000).length, 1);
      equal(utxos.filter((x: UTXO)=>x.value===998999.99999976).length, 1);
    }),
    Spend(fixtures.unit.src)
  ));

function Create (name, cb) {
  return Name(`Create ${name}`, async (ctx: { rpc, rest }) => {
    await ctx.rpc.createwallet(name);
    await cb(await ctx.rpc.getwalletinfo());
    return ctx
  })
};

function Rescan (cb) {
  return Name(`Rescan`, async (ctx: { rpc, rest }) => {
    await ctx.rpc.rescanblockchain();
    await cb(await ctx.rpc.getwalletinfo());
    return ctx
  })
};

function Deploy (p2tr: string, _cb?: Fn) {
  return Name(`Deploy ${p2tr}`, async (ctx: Btc) => {
    const user = await ctx.rpc.getnewaddress("fadroma", "bech32");
    //equal((await ctx.rpc.validateaddress(user)).isvalid, true);
    const txId = await ctx.rpc.sendtoaddress(p2tr, 1000);
    await ctx.rpc.generatetoaddress(1, user);
    const tx = await ctx.rest.tx(txId) as { blockhash: string };
    const block = await ctx.rest.block(tx.blockhash);
    return Object.assign(ctx, { user, block, tx });
  })
}

function Spend (source: string, _cb?: Fn) {
  return Name('Spend', async ({ rpc, rest, user, tx, block }, { log }) => {
    const destination = user;//await rpc.getnewaddress();
    //console.log({destination, tx});
    const program = await Simf(source).compile();
    const { txid: txId, hex: txBytes } = tx;
    const spend = program.spend({ witness: '', destination, txId, txBytes, });
    log({spend});
  })
}

function hasBalance (balance) {
  return info => equal(info.balance, balance)
}

function Log (on) {
  return Name(`Log: ${on}`, (ctx) => {
    if (on) {
      ctx.stdout.pipe(stdout);
      ctx.stderr.pipe(stdout);
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

function ExpectSourceCmr (source: string, cmr?: string) {
  return Name(`ExpectSourceCmr ${source.length}b`, (compile: Fn, context) => {
    const result = compile(source, {}).toJSON() as { cmr: string };
    if (cmr) equal(result.cmr, cmr);
    return compile;
  });
}

function ExpectCmrP2tr (cmr: string, expectedP2TR?: string) {
  return (cmrToP2TR: Fn) => {
    throws(()=>cmrToP2TR());
    const p2tr = cmrToP2TR(cmr);
    if (expectedP2TR) equal(p2tr, expectedP2TR);
    return cmrToP2TR
  }
}


