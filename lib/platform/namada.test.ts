#!/usr/bin/env -S deno run --allow-read --allow-env --allow-run --allow-write=/tmp/fadroma --allow-import=cdn.skypack.dev:443,deno.land:443 --allow-net=127.0.0.1:18443
import { resolvePath } from '../deps.ts';
import { Test        } from '../index.ts';
import { Namada      } from './namada.ts';
const { the, is, has } = Test;
const wasm = resolvePath(import.meta.dirname, "namada/pkg/fadroma_namada_bg.wasm");
export default Test.suite(import.meta, 'Namada',
  the('Wasm', async () => Namada.Wasm(await Deno.readFile(wasm)),
    has('address',                'function'),
    has('address_to_amount',      'function'),
    has('addresses',              'function'),
    has('balance_key',            'function'),
    has('block',                  'function'),
    has('code_hash',              'function'),
    has('epoch_duration',         'function'),
    has('gas_cost_table',         'function'),
    has('gov_parameters',         'function'),
    has('gov_proposal',           'function'),
    has('gov_proposal_code_key',  'function'),
    has('gov_result',             'function'),
    has('gov_votes',              'function'),
    has('pgf_parameters',         'function'),
    has('pos_commission_pair',    'function'),
    has('pos_parameters',         'function'),
    has('pos_validator_metadata', 'function'),
    has('pos_validator_set',      'function'),
    has('pos_validator_state',    'function'),
    has('storage_keys',           'function'),
    has('tx',                     'function'),
    has('u32',                    'function'),
    has('u64',                    'function'),
    has('vec_string',             'function')));
import { testSuite, expect, curry } from '@hackbg/fadroma';
import * as Namada from './lib/namada.ts';
import { readFileSync } from 'node:fs'
export default testSuite(import.meta, 'Namada',
  expect('Localnet',
    expect('Subscribe'),
    expect('Fetch',
      expect('Connect'),
      expect('Block'),
      expect('Account'),
      expect('TX'),
      expect('ABCI', async () => {
        const url = 'https://rpc.knowable.run/'
        const console = new Namada.Console('test')
        const decoderWasm = readFileSync('./namada/pkg/fadroma_namada_bg.wasm');
        const decoder = await Namada.initDecoder(decoderWasm)
        decoder.storage_keys()
        await Namada.chain({ id: 'test' })
        await Namada.chain({ id: 'test' })
        await Namada.chain({ id: 'test', decoder: decoderWasm })
        try { ;(await Namada.chain({ id: 'test', url, decoder: decoderWasm })).connect() } catch { /* */ }
        const chain = await Namada.chain({ id: 'test', url, decoder: decoderWasm })
        const connection = chain.connect(url) as Namada.Connection
        await connection.fetchProtocolParameters()
        await connection.fetchStakingParameters()
        await connection.fetchTotalStaked()
        await connection.fetchValidatorAddresses()
        await connection.fetchValidatorsConsensus()
        await connection.fetchValidatorsBelowCapacity()
        await connection.fetchValidators()
        await connection.fetchGovernanceParameters()
        await connection.fetchProposalCount()
        await connection.fetchProposalInfo(0)
        await connection.fetchProposalVotes(0)
        await connection.fetchProposalWasm(0)
        await connection.fetchProposalResult(0)
        await connection.fetchPgfParameters()
        await connection.fetchBlock()
        await connection.fetchNextBlock()
        await connection.fetchHeight()
        await connection.fetchNextHeight()
      }))));

//await connection.fetchBalance()
//await connection.fetchBalance()
//await connection.fetchStorageValue('test')
//await connection.fetchProtocolParameters('test')

//console.log(await namada.getConnection().abciQuery(
  //'/shell/value/#tnam1qsqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqxdl54l/max_tx_bytes'
//))
//console.log(await namada.fetchBalance(
  //'tnam1qrklwz5rvjqv9qafdgkjwn94pke770w46gzggsm9',
  //'tnam1q87wtaqqtlwkw927gaff34hgda36huk0kgry692a',
//))

//console.log(await namada.fetchEpochDuration())
//console.log(await namada.fetchProtocolParameters())
  //console.log(await namada.fetchDelegationsAt(
    //'tnam1qpr2uzf9pgrd6sucp34wq5gss5rm2un5lszcwzqc'
  //))
  //const test = await namada.fetchValidators({
    //details:         true,
    //parallel:        false,
    //parallelDetails: true,
  //});
  //console.log({test})
  //console.log(await (await connection.getValidator('tnam1q9sdarpylwxd5vv3e8u6wstrpz052jhls5g4a3wg')).fetchDetails(connection))
  //console.log(connection.decode.address(new Uint8Array([
    //0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  //])))
  //let block
  //let height = 100000
  //do {
    //block = await connection.getBlock(Number(height))
    //height = block.header.height
    //console.log()
      //.log('Block:', bold(block.header.height))
      //.log('ID:   ', bold(block.id))
      //.log('Time: ', bold(block.header.time))
      //.log(bold('Transactions:'))
    //for (const tx of block.txsDecoded) {
      //console.printTx(tx)
      //console.printTxSections(tx.sections)
      //console.log({content: tx.content})
    //}
    //console.br()
    //height--
  //} while (height > 0)
  //console.log({block})
