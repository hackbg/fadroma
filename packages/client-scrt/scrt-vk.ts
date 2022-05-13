import { Client } from '@fadroma/client'
import { randomBytes } from 'crypto'

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  create <R> (entropy = randomBytes(32).toString("hex")): Promise<R> {
    return this.execute({
      create_viewing_key: { entropy, padding: null }
    }).then((tx) => {
      console.warn('TODO decode response from create viewing key')
      return tx
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
  }

  set <R> (key): Promise<R> {
    return this.execute({
      set_viewing_key: { key }
    }).then((tx) => {
      console.info(tx)
      return tx
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
  }

}
