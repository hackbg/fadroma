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
const NO_COLOR    = env.NO_COLOR === '1'                                                                                                                                                                                   
const ANSI_RESET  = NO_COLOR ? '' :`\x1b[0m`

const ANSI_RED    = NO_COLOR ? '' :`\x1b[0;31m`
const ANSI_GREEN  = NO_COLOR ? '' :`\x1b[0;32m`
const ANSI_YELLOW = NO_COLOR ? '' :`\x1b[0;33m`
const ANSI_BLUE   = NO_COLOR ? '' :`\x1b[0;34m`
const ANSI_PURPLE = NO_COLOR ? '' :`\x1b[0;35m`

export const red    = (x: Stringy) => `${ANSI_RED}${x}${ANSI_RESET}`
export const green  = (x: Stringy) => `${ANSI_GREEN}${x}${ANSI_RESET}`
export const yellow = (x: Stringy) => `${ANSI_YELLOW}${x}${ANSI_RESET}`
export const blue   = (x: Stringy) => `${ANSI_BLUE}${x}${ANSI_RESET}`
export const purple = (x: Stringy) => `${ANSI_PURPLE}${x}${ANSI_RESET}`
export const orange = (x: Stringy) => `${ANSI_PURPLE}${x}${ANSI_RESET}` // FIXME
