import { Tendermint } from '../deps.ts'
/** A Namada error. */
export class Error extends Tendermint.Error {}
/** A Namada logger. */
export class Console extends Tendermint.Console {
  warnNoDecoder = () => this.warn(
    "decoder binary not provided; trying to decode namada objects will fail"
  )
}
