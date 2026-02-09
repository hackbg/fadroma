#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import Btc from './btc.ts';
import Simf from './simf.ts';
import Example, { REISSUE, DECIMAL, INITIAL } from './simf.examples.ts';
import { Fn, Test } from '../index.ts';
import { equal, throws, rejects } from '../deps.ts';
const { the, is, has } = Test;
/** Test the Simplicity support. */
export default Test.suite(import.meta, 'Simf', testWasm(), testDeploy());
/** Test the top-level functions of the WASM module. */
function testWasm (Examples = Example()) {
  // Test the main methods oof the WASM module:
  return the('WASM', Simf.Wasm,
    // Test cmr_to_p2tr on each example.
    has('cmr_to_p2tr', is('function'), ...Examples.map(testAddress)),
    // Test compile on each example.
    has('compile',     is('function'), ...Examples.map(testCompile)));
  /** Test cmr_to_p2tr on a given example. */
  function testAddress ({ cmr, p2tr: expectedP2TR }: Example) {
    return (cmrToP2TR: Fn) => {
      throws(()=>cmrToP2TR());
      const p2tr = cmrToP2TR(cmr);
      if (expectedP2TR) equal(p2tr, expectedP2TR);
      return cmrToP2TR
    }
  }
  /** Test compile on a given example. */
  function testCompile ({ src, cmr }: Example) {
    return Fn.Name(`Compile (${src.length}b)`, (compile: Fn) => {
      const result = compile(src, {}) as { toJSON: Fn.Returns<{ cmr: unknown }> };
      if (cmr) equal(result.toJSON().cmr, cmr);
      return compile;
    });
  }
}

/** Test deploying SimplicityHL programs. */
function testDeploy (Examples = Example()) {
  // Current balance. Stateful among cases. FIXME: move to step context
  let bitcoin = Number(INITIAL.COINS / DECIMAL);

  // Test deploying each example on localnet:
  return the('Deploy',
    // Start by spawning a localnet:
    () => Btc(daemonOptions()),
    // Pipe daemon output to stderr
    Btc.Verbose(false),
    // Create empty test wallet
    Btc.CreateWallet('test-simf', testHasBalance({ "bitcoin": 0 })),
    // Which after rescan turns out to not be empty
    Btc.Rescan(testHasBalance({ bitcoin, [REISSUE]: 1 })),
    // Test funding and spending each example:
    ...Examples.map((example, index)=>testDeployAndRun(example, index)),
    // Shutdown the localnet.
    (btc: Btc) => btc.kill(9));

  /** Define test case for a given example. */
  function testDeployAndRun ({ name, p2tr, cost, src, fail }: Example, index: number) {
    return Fn.Name(`${name} (${p2tr})`, async (context: Btc) => {
      const { rpc, rest } = context;
      // Fund program from deployer
      const { hex } = await fundProgram(p2tr, 1);
      // Spend from program
      await spendProgram(src, hex);

      return context;

      // Perform a fund transaction, which "deploys" the program.
      async function fundProgram (p2tr: string, amount: number) {
        const id = await rpc.sendtoaddress(p2tr, String(amount));
        const tx = await rest.tx(id);
        //await assertBalance(bitcoin -= (1 + cost));
        equal(tx.vout.length, 3);
        const hasVout   = (f: Fn, t: string) => equal(tx.vout.filter(f).length, 1, `post deploy: ${t}`);
        const isBalance = (x: Btc.Vout)=>((x.value===1) && (x.scriptPubKey.address == p2tr));
        const isFee     = (x: Btc.Vout)=>x.value===cost;
        hasVout(isBalance, `balance: program ${p2tr} must receive ${amount}`);
        hasVout(isFee,     `fee: deploy fee must be ${cost}`);
        //hasVout((x: Btc.Vout)=>x.value===bitcoin,
          //`remaining: must be ${bitcoin}`);
        return tx;
      }

      // Perform a spend transaction, which evaluates the program.
      async function spendProgram (
        src: string, tx: Simf.Tx, amount = 1-1e-4, fee = 1e-4, witness = ''
      ) {
        const user = await rpc.getnewaddress(`fadroma-${index}`, "bech32");
        const prog = await Simf(src).compile();
        equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: 0 });
        if (fail) {
          rejects(()=>prog.spend({ rpc, rest, tx, amount, fee, witness, to: user }));
          equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: 0 });
          return null;
        } else {
          const sent = await prog.spend({ rpc, rest, tx, amount, fee, witness, to: user });
          equal(await rpc.getreceivedbyaddress(user, 0), { bitcoin: amount });
          return sent;
        }
      }
    })
  }

  function testHasBalance <T> (balance: T) {
    return (info: { balance: T }) => equal(info.balance, balance)
  }

  function daemonOptions (
    chain = 'elementsregtest'
    //chain = 'liquidtestnet'
  ): Btc.Options {
    return {
      chain,
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

}
