import type { Identified, Id, Colorful, Stringy } from '../types.ts';
import { env, randomColor } from '../deps.ts';
/** Generate predictable color from ID. */
export const assignColor = <
  C extends Colorful & Identified<I>,
  I extends Id
> (thing: C): C => Object.assign(thing, { color: randomColor({
  luminosity: 'dark', // TODO random color in okhsl space
  seed: String(thing.id)
}) })
// TODO color registry
export const NO_COLOR = env.NO_COLOR === '1'                                                                                                                                                                                   
export const ANSI_RESET  = NO_COLOR ? '' : `\x1b[0m`
const ANSI_RED    = NO_COLOR ? '' : `\x1b[0;31m`
const ANSI_GREEN  = NO_COLOR ? '' : `\x1b[0;32m`
const ANSI_YELLOW = NO_COLOR ? '' : `\x1b[0;33m`
const ANSI_BLUE   = NO_COLOR ? '' : `\x1b[0;34m`
const ANSI_PURPLE = NO_COLOR ? '' : `\x1b[0;35m`
const ANSI_ORANGE = NO_COLOR ? '' : `\x1b[38;5;208m`
export const GRAY = (depth: number) => [
  '\x1b[38;5;255m',
  '\x1b[38;5;254m',
  '\x1b[38;5;253m',
  '\x1b[38;5;252m',
  '\x1b[38;5;251m',
  '\x1b[38;5;250m',
][depth]

export const red    = (x: Stringy) => `${ANSI_RED}${x}${ANSI_RESET}`
export const green  = (x: Stringy) => `${ANSI_GREEN}${x}${ANSI_RESET}`
export const yellow = (x: Stringy) => `${ANSI_YELLOW}${x}${ANSI_RESET}`
export const blue   = (x: Stringy) => `${ANSI_BLUE}${x}${ANSI_RESET}`
export const purple = (x: Stringy) => `${ANSI_PURPLE}${x}${ANSI_RESET}`
export const orange = (x: Stringy) => `${ANSI_ORANGE}${x}${ANSI_RESET}` // FIXME
export const gray = (depth: number, x: Stringy) =>
  `${GRAY(depth)}${x}${ANSI_RESET}`
