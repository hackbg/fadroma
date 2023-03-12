export const name     = 'Mock Snip20 Token'

export const address  = 'testing1someaddress'

export const codeHash = '000000000000000000000000000000000000000000000000000000000000000'

export const symbol   = 'TESTING'

export const decimals = 8

export const total_supply =
  String(Math.floor(Math.random()*1000))

export const agent = {

  address: 'testing1someagent',

  async getHash () {
    return 'fetchedCodeHash'
  },

  async query (msg: any) {
    if (Object.keys(msg)[0] === 'token_info') return {
      token_info: {
        name,
        symbol,
        decimals,
        total_supply
      }
    }
  }

}
