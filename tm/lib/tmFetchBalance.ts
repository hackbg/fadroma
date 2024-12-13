export function fetchBalance (chain: Chain, ...args: Parameters<Chain["fetchBalance"]>) {
  const requests: Record<Address, string[]> = {}
  if (args[0] && !(args[0] instanceof Array)) {
    args[0] = [args[0]]
  }
  if (args[0]) {
    for (const address of args[0] as Address[]) {
      requests[address] ??= []
      if (args[1] as any instanceof Array) {
        for (const token of args[1]!) {
          requests[address].push(token)
        }
      } else if (args[1]) {
        requests[address].push(args[1])
      }
    }
  }
  return chain.getConnection().fetchBalanceImpl({
    addresses: requests
  })
}

  //[>* Get balance of current identity in main token. <]
  //get balance () {
    //if (!chain.identity?.address) {
      //throw new Error('not authenticated, use .getBalance(token, address)')
    //} else if (!chain.defaultDenom) {
      //throw new Error('no default token for chain chain, use .getBalance(token, address)')
    //} else {
      //return chain.getBalanceOf(chain.identity.address)
    //}
  //}
  /** Get the balance in a native token of a given address,
    * either in chain connection's gas token,
    * or in another given token. */
  //getBalanceOf (address: Address|{ address: Address }, token?: string) {
    //if (!address) {
      //throw new Error('pass (address, token?) to getBalanceOf')
    //}
    //token ??= chain.defaultDenom
    //if (!token) {
      //throw new Error('no token for balance query')
    //}
    //const addr = (typeof address === 'string') ? address : address.address
    //if (addr === chain.identity?.address) {
      //chain.log.debug('Querying', bold(token), 'balance')
    //} else {
      //chain.log.debug('Querying', bold(token), 'balance of', bold(addr))
    //}
    //return timed(
      //chain.doGetBalance.bind(chain, token, addr),
      //({ elapsed, result }) => chain.log.debug(
        //`Queried in ${elapsed}s: ${bold(address)} has ${bold(result)} ${token}`
      //)
    //)
  //}
  /** Get the balance in a given native token, of
    * either chain connection's identity's address,
    * or of another given address. */
  //getBalanceIn (token: string, address?: Address|{ address: Address }) {
    //if (!token) {
      //throw new Error('pass (token, address?) to getBalanceIn')
    //}
    //address ??= chain.identity?.address
    //if (!address) {
      //throw new Error('no address for balance query')
    //}
    //const addr = (typeof address === 'string') ? address : address.address
    //if (addr === chain.identity?.address) {
      //chain.log.debug('Querying', bold(token), 'balance')
    //} else {
      //chain.log.debug('Querying', bold(token), 'balance of', bold(addr))
    //}
    //return timed(
      //chain.doGetBalance.bind(chain, token, addr),
      //({ elapsed, result }) => chain.log.debug(
        //`Queried in ${elapsed}s: balance of ${bold(address)} is ${bold(result)}`
      //)
    //)
  //}

