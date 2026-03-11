import { p2wpkh } from 'npm:@scure/btc-signer';
import { Fn, Obj, Run, Spawn, Port, Temp, Test } from '../../library/index.ts';
import Btc from './Btc.ts';
import Rpc from './BtcRpc.ts';

export default Daemon;

/** A local Bitcoin node. */
type Daemon = Btc & Run & { verbose?: boolean };

/** Run a local node. */
async function Daemon <T extends Daemon> (options: Daemon.Options = {}) {
  const { daemon = 'elementsd', debug = console.debug } = options;
  const { url, rpcport, args } = await Daemon.Options(options);
  const spawn = Spawn(daemon, ...args.filter(Boolean));
  debug('Spawning:', [spawn.daemon, ...spawn.options].join(' '));
  const spawned = await Promise.resolve(spawn());
  await Port.wait(rpcport);
  return Obj(spawned, Btc({ rpc: url, rest: url }));
}

/** Internals for running Bitcoin daemon. */
namespace Daemon {
  /** Bitcoin daemon runner options. */
  export type Options = Btc.Options & Parameters<typeof Options>[0];
  /** Parse [Flags] to list of command-line arguments: */
  export async function Options ({
    daemon = 'elementsd' as string,
    verbose = false,

    // `debug` may be taken by `Log`
    debugs = null as boolean|string[],
    debugexclude = null as string[],

    acceptnonstdtxn             = null             as boolean,
    anyonecanspendaremine       = null             as boolean,
    bech32_hrp                  = null             as string,
    blech32_hrp                 = null             as string,
    blindedaddresses            = null             as boolean,
    blindedprefix               = null             as number,
    con_blocksubsidy            = null             as number,
    con_elementsmode            = null             as boolean,
    con_connect_genesis_outputs = null             as boolean,
    chain                       = 'regtest'        as string,
    datadir                     = temp(chain)      as string|Promise<string>,
    defaultpeggedassetname      = null             as string,
    discover                    = null             as boolean,
    dnsseed                     = null             as boolean,
    evbparams                   = null             as string,
    feeasset                    = null             as string,
    initialfreecoins            = null             as string|number|bigint,
    initialreissuancetokens     = null             as string|number|bigint,
    maxtxfee                    = null             as string|number|bigint,
    persistmempool              = null             as boolean,
    pubkeyprefix                = null             as number,
    rest                        = null             as boolean,
    rpcallowip                  = '127.0.0.1'      as string,
    rpcpassword                 = `fadroma`        as string,
    rpcport                     = '8941'           as string|number,
    rpcuser                     = `fadroma`        as string,
    scriptprefix                = null             as number,
    server                      = null             as boolean,
    subsidyasset                = null             as string,
    txindex                     = null             as boolean,
    validatepegin               = null             as boolean,
    vbparams                    = null             as string,
  } = {}) {
    const url = `http://${rpcuser}:${rpcpassword}@${rpcallowip}:${rpcport}`;
    const args = [
      ((typeof debugs === 'boolean')&& debugs) && '-debug',
      ((debugs instanceof Array)    && debugs) && `-debug=${(debugs as string[]).join(',')}`,

      (typeof debugexclude === 'string') && `-debugexclude=${debugexclude}`,
      (debugexclude instanceof Array)    && `-debugexclude=${(debugexclude as string[]).join(',')}`,

      (acceptnonstdtxn             !== null) && `-acceptnonstdtxn=${bool(acceptnonstdtxn)}`,
      (anyonecanspendaremine       !== null) && `-anyonecanspendaremine=${bool(anyonecanspendaremine)}`,
      (bech32_hrp                  !== null) && `-bech32_hrp=${bech32_hrp}`,
      (blech32_hrp                 !== null) && `-blech32_hrp=${blech32_hrp}`,
      (blindedaddresses            !== null) && `-blindedaddresses=${bool(blindedprefix)}`,
      (blindedprefix               !== null) && `-blindedprefix=${blindedprefix}`,
      (chain                       !== null) && `-chain=${chain}`,
      (con_blocksubsidy            !== null) && `-con_blocksubsidy=${Number(con_blocksubsidy)||0}`,
      (con_elementsmode            !== null) && `-con_elementsmode=${bool(con_elementsmode)}`,
      (con_connect_genesis_outputs !== null) && `-con_connect_genesis_outputs=${con_connect_genesis_outputs?'1':'0'}`,
      (datadir                     !== null) && `-datadir=${await datadir}`,
      (defaultpeggedassetname      !== null) && `-defaultpeggedassetname=${defaultpeggedassetname}`,
      (discover                    !== null) && `-discover=${bool(discover)}`,
      (dnsseed                     !== null) && `-dnsseed=${bool(dnsseed)}`,
      (evbparams                   !== null) && `-evbparams=${evbparams}`,
      (feeasset                    !== null) && `-feeasset=${feeasset}`,
      (initialfreecoins            !== null) && `-initialfreecoins=${initialfreecoins}`,
      (initialreissuancetokens     !== null) && `-initialreissuancetokens=${initialreissuancetokens}`,
      (maxtxfee                    !== null) && `-maxtxfee=${maxtxfee}`,
      (persistmempool              !== null) && `-persistmempool=${bool(persistmempool)}`,
      (pubkeyprefix                !== null) && `-pubkeyprefix=${pubkeyprefix}`,
      (rest                        !== null) && `-rest=${bool(rest)}`,
      (rpcallowip                  !== null) && `-rpcallowip=${rpcallowip}`,
      (rpcpassword                 !== null) && `-rpcpassword=${rpcpassword}`,
      (rpcport                     !== null) && `-rpcport=${rpcport}`,
      (rpcuser                     !== null) && `-rpcuser=${rpcuser}`,
      (scriptprefix                !== null) && `-scriptprefix=${scriptprefix}`,
      (server                      !== null) && (server ? '-server' : null),
      (subsidyasset                !== null) && `-subsidyasset=${subsidyasset}`,
      (txindex                     !== null) && `-txindex=${bool(txindex)}`,
      (validatepegin               !== null) && `-validatepegin=${validatepegin}`,
      (vbparams                    !== null) && `-vbparams=${vbparams}`,
      //'-debug=rpc', //'-debug=zmq',
    ];
    return { url, rpcport, args, daemon, verbose }
  }
  // Helper for boolean arguments
  const bool = (x: unknown) => x ? '1' : '0';
  // Helper for temporary directories
  const temp = (chain: string) => Temp.make(`${chain}-${+new Date()}`)
}

/** Spawn Elements in `elementsregtest` mode with Simplicity enabled. */
export async function ElementsRegtest (options?: Daemon.Options) {
  return Obj(Daemon(ElementsRegtest.options(options)), { ...ElementsRegtest });
}

export namespace ElementsRegtest {

  export const ID              = 'elementsregtest';
  export const HRP_BECH32      = 'ert';
  export const HRP_BLECH32     = 'el';
  export const BITCOIN         = 100000000n;
  export const INITIAL_COINS   = BITCOIN * 1000000n;
  export const INITIAL_REISSUE = BITCOIN * 1n;
  export const PREFIX_P2PKH    = 235;
  export const PREFIX_P2SH     = 75;
  export const PREFIX_BLIND    = 4;
  export const PREFIX_PUBKEY   = 36;
  export const PREFIX_SCRIPT   = 13;
  export const P2WPKH = (x: Uint8Array) => p2wpkh(x, { // FIXME: mismatch?
    bech32: HRP_BECH32, pubKeyHash: 0x6f, scriptHash: 0xc4, wif: 0xef,
  });
  /** Well-known asset IDs for Bitcoin. */
  export const ASSETS = {
    /** Asset ID for Bitcoin. */
    DEFAULT: 'b2e15d0d7a0c94e4e2ce0fe6e8691b9e451377f6e46e8045a86f7c4b5d4f0f23',
    /** Asset ID for default initial reissuance token. */
    REISSUE: 'a6be6b365498cd451be75ba0f68c258ee01e08f3cb30d5f8469f6628db58dc61',
  };
  /** Wrap a sequence of test steps with an Elements Regtest localnet.
    *
    * FIXME: Make sure node is cleaned and the tempdir is cleaned up on test throw.
    * As a first step, make it not reuse /tmp/fadroma, but go under /tmp/fadroma/<timestamp> */
  export const Test = elementsRegtestHarness;

  export const options = function elementsRegtestOptions (options?: Partial<Daemon.Options>) {
    return {
      chain:                       ElementsRegtest.ID,
      bech32_hrp:                  ElementsRegtest.HRP_BECH32,
      blech32_hrp:                 ElementsRegtest.HRP_BLECH32,
      blindedprefix:               ElementsRegtest.PREFIX_BLIND,
      pubkeyprefix:                ElementsRegtest.PREFIX_PUBKEY,
      scriptprefix:                ElementsRegtest.PREFIX_SCRIPT,
      initialfreecoins:            ElementsRegtest.INITIAL_COINS,
      initialreissuancetokens:     ElementsRegtest.INITIAL_REISSUE,

      vbparams:                    "taproot:1:1",
      evbparams:                   'simplicity:-1:::',
      acceptnonstdtxn:             true,
      anyonecanspendaremine:       true,
      blindedaddresses:            true,
      con_blocksubsidy:            0,
      con_connect_genesis_outputs: true,
      con_elementsmode:            true,
      defaultpeggedassetname:      'bitcoin',
      maxtxfee:                    100.0,
      validatepegin:               false,
      //feeasset:                  BITCOIN,
      //subsidyasset:              BITCOIN,

      persistmempool:              false,
      discover:                    false,
      dnsseed:                     false,
      server:                      true,
      txindex:                     true,

      rest:                        true,
      rpcallowip:                  '127.0.0.1',
      rpcpassword:                 'fadroma',
      rpcport:                     8941,
      rpcuser:                     'fadroma',

      ...options || {}
    };
  }

}

function elementsRegtestHarness (
  options: Daemon.Options, ...steps: unknown[]
) {
  let name = 'elementsregtest';
  if (typeof steps[0] === 'string') name = steps.shift() as string;
  // When starting the localnet, the genesis balance is not indexed.
  const BALANCE_EMPTY = { bitcoin: 0 };
  // After RPC rescanblockchain, it shoud look like this.
  const BALANCE_INITIAL = {
    [ElementsRegtest.ASSETS.REISSUE]: 1,
    bitcoin: Number(ElementsRegtest.INITIAL_COINS / ElementsRegtest.BITCOIN)
  };
  return Test(name, () => ElementsRegtest(options), // Boot localnet.
    Run.Verbose(options?.verbose), // Pipe localnet output to stderr.
    Rpc.CreateWallet('test-simf', AssertBalance(BALANCE_EMPTY)),
    Rpc.Rescan(AssertBalance(BALANCE_INITIAL)),
    ...steps, // Run test steps passed by caller.
    Run.Kill(9) // Shutdown localnet.
  )

  /** Define test case for expected wallet balance. */
  function AssertBalance <T> (balance: T) {
    return Fn.Name(`Wallet balance is ${JSON.stringify(balance)}`, (info: { balance: T }) => {
      for (const key of Object.keys(balance)) {
        const expected = info.balance[key];
        const actual = balance[key];
        if (expected !== actual) {
          throw new Error(`expected balance in ${key} to be ${expected}, got ${actual}`);
        }
      }
    })
  }
}
