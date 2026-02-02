#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:8941,liquidtestnet.com:443,blockstream.info:443
import Btc from './btc.ts';
import Simf from './simf.ts';
import Examples from './simf.examples.ts';
import { Fn, Test, Port } from '../index.ts';
import { equal, throws, stderr } from '../deps.ts';
const { the, is, has } = Test;
///** Asset ID for regular old Bitcoin. */
//const BITCOIN = 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23';
///** Asset IDs of (t)L-BTC. */
//const LIQUID  = { mainnet: '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
//               , testnet: '144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49' };
/** Asset ID for initial reissuance token. */
const REISSUE = 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61';
/** 1 BTC = 100000000 Satoshis. */
const DECIMAL = 100000000n;
/** Values for `initialfreecoins` and `initialreissuancetokens`. */
const INITIAL = { COINS: 1000000n * DECIMAL, REISSUE: 1n * DECIMAL };
/** Predefined example program. */
type Example = { cost?: number, cmr?: string, p2tr?: string, src: string };
/** Test the Simplicity support. */
export default Test.suite(import.meta, 'Simf', testWasm(), testDeploy());
/** Test the top-level functions of the WASM module. */
function testWasm (examples = Examples()) {
  return the('WASM', Simf.Wasm,
    has('default',     is('function')),
    has('cmr_to_p2tr', is('function'), ...examples.map(Address)),
    has('compile',     is('function'), ...examples.map(Compile)),
  );
  function Address ({ cmr, p2tr: expectedP2TR }: Example) {
    return (cmrToP2TR: Fn) => {
      throws(()=>cmrToP2TR());
      const p2tr = cmrToP2TR(cmr);
      if (expectedP2TR) equal(p2tr, expectedP2TR);
      return cmrToP2TR
    }
  }
  function Compile ({ src, cmr }: Example) {
    return Fn.Name(`Compile (${src.length}b)`, (compile: Fn) => {
      const result = compile(src, {}) as { toJSON (): { cmr: string }, spend (): object };
      if (cmr) equal(result.toJSON().cmr, cmr);
      equal(typeof result.spend, 'function');
      return compile;
    });
  }
}
/** Test deploying a simplicity program. */
function testDeploy (examples = Examples()) {
  let bitcoin = Number(INITIAL.COINS / DECIMAL); // FIXME: move to step context
  return the('Deploy', () => Btc(daemonOptions()),
    Verbose(true),             // Pipe daemon output to stderr
    Port.Wait({ port: 8941 }), // Wait for RPC to open
    TestWallet('test-simf', HasBalance({ "bitcoin": 0 })),
    Rescan(HasBalance({ bitcoin, [REISSUE]: 1 })),
    ...examples.map((example, index)=>testDeployAndRun(example, index)),
    ({ btc }) => btc.kill());

  function HasBalance <T> (balance: T) {
    return (info: { balance: T }) => equal(info.balance, balance)
  }
  function testDeployAndRun ({ p2tr, cost, src }: Example, index: number) {
    return Fn.Name(`${p2tr}`, async (ctx: Btc) => {
      const { rpc, rest } = ctx;
      const user = await createDeployer(rpc, index);
      const txFund = await fundProgram(p2tr, 1);
      const txSpend = await spendProgram(src, txFund.hex);
      return ctx;
      async function fundProgram (p2tr, amount) {
        const txId = await rpc.sendtoaddress(p2tr, String(amount));
        const tx = await rest.tx(txId);
        await assertBalance(rpc, bitcoin -= (1 + cost));
        assertPostDeployVouts(tx, 1);
        return tx;
      }
      async function spendProgram (src, tx, value = 1-1e-4, fee = 1e-4, witness = '') {
        const program = await Simf(src).compile();
        const spend = program.spend({ tx, value, fee, witness, to: user });
        const sent = await rpc.sendrawtransaction(spend.hex);
        await rpc.generatetoaddress(1, user);
        await rpc.rescanblockchain();
        const sentTx = await rest.tx(sent);
        await assertBalance(rpc, bitcoin += value);
        return sentTx;
      }
      function assertPostDeployVouts (tx, amount) {
        equal(tx.vout.length, 3);
        const hasOne = (f: Fn, t) =>
          equal(tx.vout.filter(f).length, 1, `post deploy: ${t}`);
        hasOne((x: Btc.Vout)=>((x.value===amount) && (x.scriptPubKey.address == p2tr)),
          `balance: program ${p2tr} must receive ${amount}`);
        hasOne((x: Btc.Vout)=>x.value===cost,
          `fee: deploy fee must be ${cost}`); // Transaction fee.
        //hasOne((x: Btc.Vout)=>x.value===bitcoin,
          //`remaining: must be ${bitcoin}`); // Remaining deployer balance.
      }
    })
    async function createDeployer (rpc, index, initial = 1) {
      const user = await rpc.getnewaddress(`fadroma-${index}`, "bech32");
      await rpc.generatetoaddress(initial, user);
      return user
    }
    async function assertBalance (rpc, balance) {
      await rpc.rescanblockchain();
      const { balance: balanceAfter } = await rpc.getwalletinfo();
      equal(balanceAfter.bitcoin, balance);
    }
  }
  function TestWallet (name: string, cb?: Fn) {
    return Fn.Name(`Create test wallet ${name}`, async (ctx: { rpc, rest }) => {
      await ctx.rpc.createwallet(name);
      cb && await cb(await ctx.rpc.getwalletinfo());
      return ctx
    })
  };
  function Rescan (cb?: Fn) {
    return Fn.Name(`Rescan`, async (ctx: { rpc, rest }) => {
      await ctx.rpc.rescanblockchain();
      await cb(await ctx.rpc.getwalletinfo());
      return ctx
    })
  };
  function Verbose (on) {
    return Fn.Name(`Verbose: ${on}`, (ctx) => {
      ctx.verbose = on;
      if (on) {
        ctx.stdout.pipe(stderr);
        ctx.stderr.pipe(stderr);
      }
      return ctx
    })
  };
  function wait (time: number) {
    return Fn.Name(`Wait ${time}ms`, async (ctx: unknown) => {
      await new Promise(resolve=>setTimeout(resolve, time));
      return ctx
    })
  };
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
