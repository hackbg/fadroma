#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Fn, Test } from '../index.ts';
import { resolvePath, equal, throws } from '../deps.ts';
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
  } as Btc.DaemonOptions
};

export const testSimfWasm = the('WASM',
  () => Deno.readFile(testSimfFixtures.wasmPath),
  (wasm: Uint8Array) => Simf.Wasm(wasm),
  has('default', is('function')),
  has('compile', is('function'),
    testSimfWasmCompile(testSimfFixtures.example0.src, testSimfFixtures.example0.cmr),
    testSimfWasmCompile(testSimfFixtures.example1.src, testSimfFixtures.example1.cmr)),
  has('cmr_to_p2tr', is('function'),
    testSimfWasmCmrToP2TR(testSimfFixtures.example0.cmr, testSimfFixtures.example0.p2tr),
    testSimfWasmCmrToP2TR(testSimfFixtures.example1.cmr, testSimfFixtures.example1.p2tr)));

export default Test.suite(import.meta, 'Simf',
  testSimfWasm, the('Deploy', testSimfDeploy));

function testSimfWasmCompile (source: string, cmr?: string) {
  return (compile: Fn, context) => {
    const result = compile(source, {}) as { cmr: string };
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

async function testSimfDeploy (_: never, context: Test.Testing) {
  //const blob = await Deno.readFile(testSimfFixtures.wasmPath);
  //const { compile, cmr_to_p2tr } = await Simf.Wasm(blob);
  const { p2tr } = testSimfFixtures.example0;
  return Btc.Daemon(testSimfFixtures.daemonOptions, testSimfDeployInner)
  async function testSimfDeployInner (daemon: Btc.Daemon) {
    //daemon.stdout.pipe(stdout);
    //daemon.stderr.pipe(stdout);
    const { rpc, rest } = daemon;
    await new Promise(resolve=>setTimeout(resolve, 1000));
    await rpc.createwallet('test-simf');
    context.log(await rpc.getwalletinfo()); // TODO assert balance
    await rpc.rescanblockchain();
    context.log(await rpc.getwalletinfo()); // TODO assert balance
    const address = await rpc.getnewaddress();
    context.log(await rpc.validateaddress(address));
    const txid = await rpc.sendtoaddress(p2tr, 1000);
    await rpc.generatetoaddress(1, address);
    context.log('\n\n', {address, txid}, await rest.getutxos(`${txid}-0`));
    const _withdrawn = await prog.withdraw({ txid, dest });
  }
}
