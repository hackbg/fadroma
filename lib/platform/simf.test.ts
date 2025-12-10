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
        defaultpeggedassetname:  'fadroma',
        initialfreecoins:        '100000000000000',
        initialreissuancetokens: '200000000',
      }, async (daemon: Btc.Daemon) => {
        //daemon.stdout.pipe(stdout);
        //daemon.stderr.pipe(stdout);
        await new Promise(resolve=>setTimeout(resolve, 1000));
        const program   = Simf(path);
        const _built    = await program.build();
        const deposited = await program.deposit();
        context.log('Chain info:',  await daemon.rest.chaininfo());
        context.log('Wallet info:', await daemon.rpc.createwallet('1'));
        context.log('Wallet info:', await daemon.rpc.getwalletinfo('1'));
        context.log('UTXOs:',       await daemon.rest.getutxos('51210217e403ddb181872c32a0cd468c710040b2f53d8cac69f18dad07985ee37e9a7151ae-0.json'));
        context.log('Generate:',    await daemon.rpc.generate());
        context.log('UTXOs:',       await daemon.rest.getutxos(`http://127.0.0.1:8941/rest/getutxos/${deposited}-0.json`));
        //context.log('Balance:', await checkBalance(deposited));
        const txid = "FIXME";
        const _withdrawn = await program.withdraw({ txid, dest: deposited });
      }))));

//const FAUCET  = `https://liquidtestnet.com/faucet?address=`
//const FAUCET  = `http://127.0.0.1/faucet?address=`
//const BALANCE = `https://blockstream.info/liquidtestnet/api/address`
