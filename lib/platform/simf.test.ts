#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Fn, Test } from '../index.ts';
import { resolvePath, equal, throws, stdout } from '../deps.ts';
import { Simf } from './simf.ts';
import { Btc } from './btc.ts';
const { the, is, has } = Test;

export const testSimfFixtures = {

  wasmPath: resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm"),

  example0: {
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

  daemonOptions: {
    txindex:                 true,
    persistmempool:          false,
    dnsseed:                 false,
    server:                  true,
    chain:                   'elementsregtest',
    rest:                    true,
    discover:                false,
    rpcport:                 8941,
    rpcallowip:              '127.0.0.1',
    rpcuser:                 'fadroma',
    rpcpassword:             'fadroma',
    validatepegin:           false,
    defaultpeggedassetname:  'bitcoin',
    initialfreecoins:        1_000_000_00000000,
    initialreissuancetokens: 1_00000000,
    bech32_hrp:              'tex',
    blech32_hrp:             'tlq',
    pubkeyprefix:            36,
    scriptprefix:            13,
    blindedprefix:           23,
  } as Btc.Options

};

export default Test.suite(import.meta, 'Simf',

  the('WASM',
    () => Deno.readFile(testSimfFixtures.wasmPath),
    (wasm: Uint8Array) => Simf.Wasm(wasm),
    has('default', is('function')),
    has('compile', is('function'),
      testSimfWasmCompile(testSimfFixtures.example0.src, testSimfFixtures.example0.cmr),
      testSimfWasmCompile(testSimfFixtures.example1.src, testSimfFixtures.example1.cmr)),
    has('cmr_to_p2tr', is('function'),
      testSimfWasmCmrToP2TR(testSimfFixtures.example0.cmr, testSimfFixtures.example0.p2tr),
      testSimfWasmCmrToP2TR(testSimfFixtures.example1.cmr, testSimfFixtures.example1.p2tr))),

  the('Deploy', async function testSimfDeploy (_: never, context: Test.Testing) {
    return Btc(testSimfFixtures.daemonOptions, Do(Log(false), Wait(1000),
      Create('test-simf', info => {
        equal(info.balance, { bitcoin: 0 })
      }),
      Rescan(info => {
        equal(info.balance, {
          bitcoin: 1000000,
          ['a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61']: 1
        })
      }),
      Deploy(testSimfFixtures.example0.pt2tr, ({ chainHeight, utxos })=>{
        equal(utxos.length, 2);
        equal(utxos[0].height, chainHeight);
        equal(utxos[1].height, chainHeight);
        // utxos come in either order:
        equal(utxos.filter(x=>x.value===1000).length, 1);
        equal(utxos.filter(x=>x.value===998999.99999976).length, 1);
      }),
      Withdraw()
    ));
    function Withdraw (cb?) {
      return async ({ rpc, rest }) => {
        const _withdrawn = await prog.withdraw({ txid, dest });
      }
    }
    function Deploy (p2tr, cb) {
      return async ({ rpc, rest }) => {
        const address = await rpc.getnewaddress();
        equal((await rpc.validateaddress(address)).isvalid, true);
        const txid = await rpc.sendtoaddress(p2tr, 1000);
        await rpc.generatetoaddress(1, address);
        const { chainHeight, utxos } = await rest.getutxos(`${txid}-0/${txid}-1`);
        await cb({ chainHeight, utxos })
      }
    }
    function Do (...cbs) {
      return async context => {
        for (const cb of cbs) await Promise.resolve(cb(context))
        return context;
      }
    }
    function Log (on) {
      return (ctx) => {
        if (on) {
          ctx.stdout.pipe(stdout);
          ctx.stderr.pipe(stdout);
        }
      }
    };
    function Wait (time: number) {
      return async (_: unknown) => {
        await new Promise(resolve=>setTimeout(resolve, time));
      }
    };
    function Create (name, cb) {
      return async ({ rpc, rest }) => {
        await rpc.createwallet(name);
        await cb(await rpc.getwalletinfo());
      }
    };
    function Rescan (cb) {
      return async ({ rpc, rest }) => {
        await rpc.rescanblockchain();
        await cb(await rpc.getwalletinfo());
      }
    };
  }));

function testSimfWasmCompile (source: string, cmr?: string) {
  return (compile: Fn, context) => {
    const result = compile(source, {}).toJSON() as { cmr: string };
    if (cmr) equal(result.cmr, cmr);
    return compile;
  };
}

function testSimfWasmCmrToP2TR (cmr: string, expectedP2TR?: string) {
  return (cmrToP2TR: Fn) => {
    throws(()=>cmrToP2TR());
    const p2tr = cmrToP2TR(cmr);
    if (expectedP2TR) equal(p2tr, expectedP2TR);
    return cmrToP2TR
  }
}


