#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import { Test } from '../index.ts';
import { resolvePath, stdout } from '../deps.ts';
import { Simf } from './simf.ts';
import { Btc } from './btc.ts';

const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "simf/pkg/fadroma_simf_bg.wasm");
const path = resolvePath(import.meta.dirname, 'simf/example/01.simf');

export default Test.suite(import.meta, 'Simf',
  the('Wasm', /*async () => Simf.Wasm(await Deno.readFile(wasm)),
    has('build', is('function'))*/),
  the('Program',
    the('Define',     () => Simf(path)),
    the('Entrypoint', () => Simf({}, path)),
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
        const program = Simf(path);
        //const built = await program.build();
        const dest = await program.deposit();
        const txid = await rpc.sendtoaddress(dest, 1000);
        await rpc.generatetoaddress(1, address);
        context.log({txid}, await rest.getutxos(`${txid}-0`));
        const _withdrawn = await program.withdraw({ txid, dest });
      }))));
