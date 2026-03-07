import { Obj, Run, Spawn, Port, Temp } from '../../library/index.ts';
import Btc from './Btc.ts';

export default BtcDaemon;

/** A local Bitcoin node. */
type BtcDaemon = Btc & Run & { verbose?: boolean };

/** Run a local node. */
async function BtcDaemon <T extends BtcDaemon> (options: BtcDaemon.Options = {}) {
  const { daemon = 'elementsd', debug = console.debug } = options;
  const { url, rpcport, args } = await BtcDaemon.Options(options);
  const spawn = Spawn(daemon, ...args.filter(Boolean));
  debug('Spawning:', [spawn.daemon, ...spawn.options].join(' '));
  const spawned = await Promise.resolve(spawn());
  await Port.wait(rpcport);
  return Obj(spawned, Btc({ rpc: url, rest: url }));
}

/** Internals for running Bitcoin daemon. */
namespace BtcDaemon {
  /** Bitcoin daemon runner options. */
  export type Options = Btc.Options & Parameters<typeof Options>[0];
  /** Parse [Flags] to list of command-line arguments: */
  export async function Options ({
    daemon = 'elementsd' as string,

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
    return { url, rpcport, args }
  }
  // Helper for boolean arguments
  const bool = (x: unknown) => x ? '1' : '0';
  // Helper for temporary directories
  const temp = (chain: string) => Temp.make(`${chain}-${+new Date()}`)
}
