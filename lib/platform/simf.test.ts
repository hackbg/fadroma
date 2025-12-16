#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Fn, Test } from '../index.ts';
import { resolvePath, stdout } from '../deps.ts';
import { Simf } from './simf.ts';
import { Btc } from './btc.ts';

const { the, is, has } = Test;
const wasmPath = resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm");
const progPath = resolvePath(import.meta.dirname, 'simf/example/01.simf');
const testSimfWasmBuild = (source: string, cmr?: string) => async (build: Fn, context) => {
  const result = await build(source, {}) as { cmr: string };
  if (cmr) Test.equals(result.cmr, cmr)(context);
  return build;
}
const example0 = 'fn main () {}';
const cmr0 = 'c40a10263f7436b4160acbef1c36fba4be4d95df181a968afeab5eac247adff7';
const example1 = `fn main() {
  let ab: u16 = <(u8, u8)>::into((0x10, 0x01));
  let c: u16 = 0x1001;
  assert!(jet::eq_16(ab, c));
  let ab: u8 = <(u4, u4)>::into((0b1011, 0b1101));
  let c: u8 = 0b10111101;
  assert!(jet::eq_8(ab, c));
}`.trim();

export const testSimfWasm = the('WASM',
  () => Deno.readFile(wasmPath),
  (wasm: Uint8Array) => Simf.Wasm(wasm),
  has('default', is('function'), init => init()),
  has('build',
    is('function'),
    testSimfWasmBuild(example0, cmr0),
    testSimfWasmBuild(example1)));

export const testSimfProgram = the('Program',
  the('Define',     () => Simf(progPath)),
  the('Entrypoint', () => Simf({}, progPath)),
  the('Deploy',     (_: unknown, context: Test.Testing) =>
    Btc.Daemon({
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
    }, async (daemon: Btc.Daemon) => {
      //daemon.stdout.pipe(stdout);
      //daemon.stderr.pipe(stdout);
      const { rpc, rest } = daemon;
      await new Promise(resolve=>setTimeout(resolve, 1000));
      await rpc.createwallet('1');
      await rpc.rescanblockchain();
      //context.log(await rpc.getwalletinfo()); // TODO assert balance
      const address = await rpc.getnewaddress();
      //const valid8d = await rpc.validateaddress(address);
      const prog = Simf(progPath);
      const built = await prog.build();
      const dest = await prog.deposit();
      const txid = await rpc.sendtoaddress(dest, 1000);
      await rpc.generatetoaddress(1, address);
      context.log('\n\n',{...prog, txid, built, dest}, await rest.getutxos(`${txid}-0`));
      
      const _withdrawn = await prog.withdraw({ txid, dest });
    })));

export default Test.suite(import.meta, 'Simf',
  testSimfWasm,
  //testSimfProgram,
);
