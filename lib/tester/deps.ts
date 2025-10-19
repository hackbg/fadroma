export type {
  Info,
  Write,
  Timed,
  MaybeAsync,
  MaybeAsyncFn,
} from '@hackbg/fadroma';

export {
  isEntrypoint, curry,
  renamed, pipe, write, entrypoint, formatMsec, joined,
  red, green, blue, orange, yellow, gray, ANSI_RESET
} from '@hackbg/fadroma';

export {
  ok,
  deepStrictEqual as equal
} from 'node:assert';

export {
  setImmediate
} from 'node:timers';

export {
  stdout,
  argv,
  env
} from 'node:process';
