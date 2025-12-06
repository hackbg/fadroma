#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443,liquidtestnet.com:443,blockstream.info:443
import { Test } from '../index.ts';
import { resolvePath, stdout } from '../deps.ts';
import { Simf } from './simf.ts';
const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm");
const path = resolvePath(import.meta.dirname, 'simf/example/01.simf');
//const FAUCET  = `https://liquidtestnet.com/faucet?address=`
const FAUCET  = `http://127.0.0.1/faucet?address=`
const BALANCE = `https://blockstream.info/liquidtestnet/api/address`
export default Test.suite(import.meta, 'Simf',
  the('Wasm', /*async () => Simf.Wasm(await Deno.readFile(wasm)),
    has('build', is('function'))*/),
  the('Program',
    the('Define',     () => Simf(path)),
    the('Entrypoint', () => Simf({}, path)),
    the('Deploy',     (_: unknown, context: Test.Testing) =>
      Simf.Localnet(async (daemon) => {
        daemon.stdout.pipe(stdout);
        daemon.stderr.pipe(stdout);
        const program   = Simf(path);
        const built     = await program.build();
        context.log({built});
        const deposited = await program.deposit();
        context.log({deposited});
        //context.log(await callFaucet(deposited));
        context.log('Balance:', await callUrl(`http://127.0.0.1:8941/rest/chaininfo.json`));
        context.log('Balance:', await checkBalance(deposited));
        const txid = "FIXME";
        await program.withdraw({ txid });
      }))));
const callFaucet   = (address: string) => callUrl(`${FAUCET}${address}`);
const checkBalance = (address: string) => callUrl(`${BALANCE}/${address}/utxo`);
async function callUrl (url: string|URL) {
  const result = await fetch(url);
  const text = await result.text();
  if (result.status !== 200) {
    throw Object.assign(new Error(`${url}: ${result.status}`), { text })
  } else {
    return text;
  }
}
