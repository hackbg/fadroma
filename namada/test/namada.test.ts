import * as Namada from '../index.ts'
import { readFileSync } from 'node:fs'
import { initDecoder } from '../lib/namada.ts'
import { Console } from '../lib/namadaLogs.ts'

const console = new Console('test')

const decoder = await initDecoder(readFileSync('./pkg/fadroma_namada_bg.wasm'))
console.log(decoder.storage_keys())

const url = 'https://rpc.knowable.run/'
const namada = await Namada.connect({ url })


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
