#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443,liquidtestnet.com:443,blockstream.info:443
import { Test } from '../index.ts';
import { resolvePath } from '../deps.ts';
import { Simf } from './simf.ts';
const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm");
const path = resolvePath(import.meta.dirname, 'simf/example/01.simf');
export default Test.suite(import.meta, 'Simf',
  the('Wasm', /*async () => Simf.Wasm(await Deno.readFile(wasm)),
    has('build', is('function'))*/),
  the('Program',
    the('Define',     () => Simf(path)),
    the('Entrypoint', () => Simf({}, path)),
    the('Deploy',     async (_, context) => {
      const program = Simf(path);
      const built = await program.build();
      context.log(built);
      const deposited = await program.deposit();
      context.log(deposited);
      const FAUCET = `https://liquidtestnet.com/faucet?address=`
      const url1 = `${FAUCET}${deposited}`;
      context.log(url1);
      const result = await fetch(url1);
      context.log(await result.text());
      const BALANCE = `https://blockstream.info/liquidtestnet/api/address`
      const url2 = `${BALANCE}/${deposited}/utxo`;
      const result2 = await fetch(url2);
      const balance = await result2.text();
      context.log(balance);
      await program.withdraw({ txid });
    })));
