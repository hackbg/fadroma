import { Error } from '@hackbg/oops'

export default class TokenError extends Error {

  static NoSymbol = this.define('NoSymbol',
    ()=>'Pass a symbol to get a token')

  static NotFound = this.define('NotFound',
    (symbol: string)=>`No token in registry: ${symbol}`)

  static PassToken = this.define('PassToken',
    (symbol: string)=>'Pass a token to register')

  static CantRegister = this.define('CantRegister',
    ()=>"Can't register token without symbol")

  static AlreadyRegistered = this.define('AlreadyRegistered',
    (symbol: string) => 'Token already in registry: ')

}
