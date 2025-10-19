import { BaseError, BaseConsole } from '../deps.ts'
/** A Namada error. */
export class Error extends BaseError {}
/** A Namada logger. */
export class Console extends BaseConsole {
  warnNoDecoder = () => this.warn(
    "decoder binary not provided; trying to decode namada objects will fail"
  )
}
