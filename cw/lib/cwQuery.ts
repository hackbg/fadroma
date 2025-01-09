

  //[>* Query a contract by address. <]
  //query <T> (contract: Address, message: Message):
    //Promise<T>
  //[>* Query a contract object. <]
  //query <T> (contract: { address: Address }, message: Message):
    //Promise<T>
  //query <T> (...args: unknown[]): Promise<unknown> {
    //return query(this, ...args as Parameters<Chain["query"]>)
  //}
  //[>* Chain-specific implementation of query. <]
  //abstract queryImpl <T> (parameters: {
    //address:   Address
    //codeHash?: string
    //message:   Message
  //}): Promise<T>
