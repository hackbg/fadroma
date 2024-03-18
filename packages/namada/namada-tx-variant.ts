import { Core } from '@fadroma/agent'
import { Transaction } from './namada-tx-base'

class NamadaUndecodedTransaction extends Transaction {
  binary: Uint8Array
  error:  Error
  constructor (properties: Partial<NamadaUndecodedTransaction> = {}) {
    super()
    Core.assign(this, properties, [ "binary", "error" ])
  }
}

class NamadaRawTransaction extends Transaction {
  txType = 'Raw' as 'Raw'
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //this.txType = 'Raw'
  //}
}

class NamadaWrapperTransaction extends Transaction {
  txType = 'Wrapper' as 'Wrapper'
  //declare fee:                 {
    //token:                     string
    //amountPerGasUnit:          {
      //amount:                  bigint,
      //denomination:            number
    //},
  //}
  //declare pk:                  string
  //declare epoch:               bigint
  //declare gasLimit:            bigint
  //declare unshieldSectionHash: string|null
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //Core.assignCamelCase(this, details, wrapperTransactionFields.map(x=>x[0] as string))
    //this.txType = 'Wrapper'
  //}

//export const wrapperTransactionFields: Fields = [
  //["fee",                 struct(
    //["amountPerGasUnit",  struct(
      //["amount",          u256],
      //["denomination",    u8],
    //)],
    //["token",             addr],
  //)],
  //["pk",                  pubkey],
  //["epoch",               u64],
  //["gasLimit",            u64],
  //["unshieldSectionHash", option(hashSchema)],
//]
}

class NamadaDecryptedTransaction extends Transaction {
  txType = 'Decrypted' as 'Decrypted'
  //undecryptable: boolean
}

class NamadaProtocolTransaction extends Transaction {
  txType = 'Protocol' as 'Protocol'
  //pk: string
  //tx: |'EthereumEvents'
      //|'BridgePool'
      //|'ValidatorSetUpdate'
      //|'EthEventsVext'
      //|'BridgePoolVext'
      //|'ValSetUpdateVext'
  //constructor (header: object, details: object, sections: object[]) {
    //super(header, sections)
    //Core.assignCamelCase(this, details, protocolTransactionFields.map(x=>x[0] as string))
    //this.txType = 'Protocol'
  //}

//export const protocolTransactionFields: Fields = [
  //["pk",                   pubkey],
  //["tx",                   variants(
    //['EthereumEvents',     unit],
    //['BridgePool',         unit],
    //['ValidatorSetUpdate', unit],
    //['EthEventsVext',      unit],
    //['BridgePoolVext',     unit],
    //['ValSetUpdateVext',   unit],
  //)],
//]

}

export {
  NamadaUndecodedTransaction as Undecoded,
  NamadaRawTransaction       as Raw,
  NamadaWrapperTransaction   as Wrapper,
  NamadaDecryptedTransaction as Decrypted,
  NamadaProtocolTransaction  as Protocol,
}
