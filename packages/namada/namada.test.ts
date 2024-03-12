import * as Namada from './namada'
import { Core } from '@fadroma/cw'
import init, { Decode } from './pkg/fadroma_namada.js'
import { readFileSync } from 'node:fs'

const console = new Core.Console('test')

export default async function main () {
  const connection = await Namada.connect({
    url: 'https://namada-testnet-rpc.itrocket.net',
    decoder: readFileSync('./pkg/fadroma_namada_bg.wasm')
  })
  console.log(connection.decode.address(new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ])))
  let block
  let height = 100000
  do {
    block = await connection.getBlock(Number(height))
    height = block.header.height
    console.log()
      .log('Block:', Core.bold(block.header.height))
      .log('ID:   ', Core.bold(block.id))
      .log('Time: ', Core.bold(block.header.time))
      .log(Core.bold('Transactions:'))
    for (const i in block.txs) {
      //const tx = 
      //console.log(block.txs[i])
      const binary = block.txs[i].slice(3)
      console.log(binary)
      console.log(Core.brailleDump(binary))
      console.log(connection.decode.tx(block.txs[i].slice(3)))
      const tx = Namada.Transaction.decode(binary)
      this.log()
      tx.print(this.log)
      if (tx instanceof Namada.DecryptedTransaction) {
        console.log()
        tx.decodeInner().print(this.log)
      }
      //this.log
        //.log()
        //.log(JSON.stringify(tx, null, 2))
    }
    console.br()
    height--
  } while (height > 0)
  console.log({block})
}
