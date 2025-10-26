// TODO id -> color registry
import type { Stringy } from '../index.ts';
import { env } from '../deps.ts';
/** Color. TODO specify representation */
export type Color = unknown;
/** Thing identifiable by color. */
export type Colorful = { /** The identifying color. */ color: Color };
export const NO_COLOR = env.NO_COLOR === '1'                                                                                                                                                                                   
export const noColor = x => NO_COLOR ? '' : x;
export const escape = x => `\x1b[${x}m`;
export const ANSI_RESET  = NO_COLOR ? '' : escape('0')
export const RESET = `\x1b[0m`;
export const FG255 = (x: number) => escape(`38;5;${x}`);
export const BG255 = (x: number) => escape(`48;5;${x}`);
export const fg255 = (x: number) => (text: string) => `\x1b[38;5;${x}m`+`${text}${RESET}`;
export const bg255 = (x: number) => (text: string) => `\x1b[48;5;${x}m`+`${text}${RESET}`;
const ANSI_BOLD   = noColor('\x1b[1m');
const ANSI_DIM    = noColor('\x1b[38;5;245m');
const ANSI_RED    = noColor(`\x1b[0;31m`);
const ANSI_GREEN  = noColor(`\x1b[0;32m`);
const ANSI_YELLOW = noColor(`\x1b[0;33m`);
const ANSI_BLUE   = noColor(`\x1b[0;34m`);
const ANSI_PURPLE = noColor(`\x1b[0;35m`);
const ANSI_ORANGE = noColor(`\x1b[38;5;208m`);
export const GRAY = (depth: number) => [
  '\x1b[38;5;255m',
  '\x1b[38;5;254m',
  '\x1b[38;5;253m',
  '\x1b[38;5;252m',
  '\x1b[38;5;251m',
  '\x1b[38;5;250m',
  '\x1b[38;5;249m',
  '\x1b[38;5;248m',
  '\x1b[38;5;247m',
  '\x1b[38;5;246m',
  '\x1b[38;5;245m',
][depth]

export const bold   = (x: Stringy) => `${ANSI_BOLD}${x}${ANSI_RESET}`
export const dim    = (x: Stringy) => `${ANSI_DIM}${x}${ANSI_RESET}`
export const red    = (x: Stringy) => `${ANSI_RED}${x}${ANSI_RESET}`
export const green  = (x: Stringy) => `${ANSI_GREEN}${x}${ANSI_RESET}`
export const yellow = (x: Stringy) => `${ANSI_YELLOW}${x}${ANSI_RESET}`
export const blue   = (x: Stringy) => `${ANSI_BLUE}${x}${ANSI_RESET}`
export const purple = (x: Stringy) => `${ANSI_PURPLE}${x}${ANSI_RESET}`
export const orange = (x: Stringy) => `${ANSI_ORANGE}${x}${ANSI_RESET}` // FIXME
export const gray = (depth: number, x: Stringy) =>
  `${GRAY(depth)}${x}${ANSI_RESET}`
