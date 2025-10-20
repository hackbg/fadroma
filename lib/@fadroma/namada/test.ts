import { suite, expect, curry } from '@hackbg/fadroma';
import * as Namada from './lib/namada.ts';
import { readFileSync } from 'node:fs'
export default suite(import.meta, 'Namada',
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
