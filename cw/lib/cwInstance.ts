
  //[>* Fetch a contract's details wrapped in a `Contract` instance. <]
  //fetchContractInfo (
    //address:   Address
  //): Promise<Contract>
  //[>* Fetch a contract's details wrapped in a custom class instance. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //address:   Address
  //): Promise<InstanceType<T>>
  //[>* Fetch multiple contracts' details wrapped in `Contract` instance. <]
  //fetchContractInfo (
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, Contract>>
  //[>* Fetch multiple contracts' details wrapped in instances of a custom class. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, InstanceType<T>>>
  //[>* Fetch multiple contracts' details, specifying a custom class for each. <]
  //fetchContractInfo (
    //contracts: { [address: Address]: typeof Contract },
    //options?:  { parallel?: boolean }
  //): Promise<{
    //[address in keyof typeof contracts]: InstanceType<typeof contracts[address]>
  //}>
  //async fetchContractInfo (...args: unknown[]): Promise<unknown> {
    //return fetchContractInfo(this, ...args as Parameters<Chain["fetchContractInfo"]>)
  //}
  //[>* Chain-specific implementation of fetchContractInfo. <]
  //abstract fetchContractInfoImpl (parameters: {
    //contracts: { [address: Address]: typeof Contract },
    //parallel?: boolean
  //}): Promise<Record<Address, Contract>>
  //[>* Call a given program's transaction method. <]
  //async execute <T> (
    //contract: Address|Partial<Contract>,
    //message:  Message,
    //options?: Omit<Parameters<SigningConnection["executeImpl"]>[0],
      //'address'|'codeHash'|'message'>
  //): Promise<T> {
    //return await execute(this, contract, message, options) as T
  //}



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
