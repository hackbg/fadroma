#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import Btc from './btc.ts';
import Simf from './simf.ts';
import Example, { REISSUE, DECIMAL, INITIAL } from './simf.examples.ts';
import { Fn, Test } from '../index.ts';
import { equal, throws } from '../deps.ts';
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
      const result = compile(src, {}) as { toJSON (): { cmr: string }, spend (): object };
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
    ({ btc }) => btc.kill());

  /** Define test case for a given example. */
  function testDeployAndRun ({ p2tr, cost, src }: Example, index: number) {
    return Fn.Name(`${p2tr}`, async (context: Btc) => {
      const { rpc, rest } = context;
      // Create deployer
      const user = await rpc.getnewaddress(`fadroma-${index}`, "bech32");
      // Fund deployer
      await rpc.generatetoaddress(1, user);
      // Fund program from deployer
      const txFund  = await fundProgram(p2tr, 1);
      // Spend from program
      const txSpend = await spendProgram(src, txFund.hex);

      context.log({ program, user, txFund, txSpend });
      return context;

      async function fundProgram (p2tr, amount) {
        const txId = await rpc.sendtoaddress(p2tr, String(amount));
        const fundTx = await rest.tx(txId);
        await assertBalance(bitcoin -= (1 + cost));
        equal(fundTx.vout.length, 3);
        const hasOne = (f: Fn, t) => equal(fundTx.vout.filter(f).length, 1, `post deploy: ${t}`);
        hasOne((x: Btc.Vout)=>((x.value===1) && (x.scriptPubKey.address == p2tr)), `balance: program ${p2tr} must receive ${amount}`);
        hasOne((x: Btc.Vout)=>x.value===cost, `fee: deploy fee must be ${cost}`); // Transaction fee.
        //hasOne((x: Btc.Vout)=>x.value===bitcoin, //`remaining: must be ${bitcoin}`); // Remaining deployer balance.
        return fundTx;
      }

      async function spendProgram (src, tx, amount = 1-1e-4, fee = 1e-4, witness = '') {
        const prog = await Simf(src).compile();
        const sent = await prog.spend({ rpc, tx, amount, fee, witness, to: user });
        //await rpc.generatetoaddress(1, user);
        await rpc.rescanblockchain();
        await assertBalance(bitcoin += amount);
        return sent;
      }

      async function assertBalance (balance) {
        await rpc.rescanblockchain();
        const { balance: balanceAfter } = await rpc.getwalletinfo();
        equal(balanceAfter.bitcoin, balance);
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
