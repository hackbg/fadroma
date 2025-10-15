import { Core } from '../deps.ts'
/** A Tendermint error .*/
export class Error extends Core.Error {}
/** A Tendermint logger .*/
export class Console extends Core.Console {
  static randomId = (): number => parseInt(Array.from({ length: 12 }) .map(() => randomNumericChar()).join(""), 10)
}
const numbersWithoutZero = "123456789"
const randomNumericChar = (): string => numbersWithoutZero[Math.floor(Math.random() * numbersWithoutZero.length)]
