export class ViewingKeyClient extends Client {

  create (entropy = randomHex(32)) {
    return this.execute({
      create_viewing_key: { entropy, padding: null }
    }).then((tx) => {
      console.warn('TODO decode response from create viewing key')
      return { tx }
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
  }

  set (key) {
    return this.execute({
      set_viewing_key: { key }
    }).then((tx) => {
      console.info(tx)
      return { tx }
      //status: JSON.parse(decode(fromHex(tx.data))).set_viewing_key.key,
    })
  }

}
