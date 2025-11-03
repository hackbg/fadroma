// TODO id -> color registry
import type { Stringy } from '../index.ts';
import { env } from '../deps.ts';

export const NO_COLOR = env.NO_COLOR === '1'                                                                                                                                                                                   
export const ifColor = x => NO_COLOR ? '' : x;

export const escaped = x => `\x1b[${x}`;

export const RESET  = NO_COLOR ? '' : escaped('0m'); // `\x1b[0m`
export const reset = (...args: unknown[]) => [...args, RESET].join('');

export const FG255 = (x: number) => escaped(`38;5;${x}m`);
export const fg255 = (x: number) => (text: string) => `\x1b[38;5;${x}m`+`${text}${RESET}`;

export const BG255 = (x: number) => escaped(`48;5;${x}m`);
export const bg255 = (x: number) => (text: string) => `\x1b[48;5;${x}m`+`${text}${RESET}`;

const BOLD = ifColor('\x1b[1m');
export const bold = (...x: Stringy[]) => reset(BOLD, ...x);

const DIM = ifColor('\x1b[38;5;245m');
export const dim = (...x: Stringy[]) => reset(DIM, ...x);

const RED = ifColor(`\x1b[0;31m`);
export const red = (...x: Stringy[]) => reset(RED, ...x);

const GREEN = ifColor(`\x1b[0;32m`);
export const green  = (...x: Stringy[]) => reset(GREEN, ...x);

const YELLOW = ifColor(`\x1b[0;33m`);
export const yellow = (...x: Stringy[]) => reset(YELLOW, ...x);

const BLUE = ifColor(`\x1b[0;34m`);
export const blue = (...x: Stringy[]) => reset(BLUE, ...x);

const PURPLE = ifColor(`\x1b[0;35m`);
export const purple = (...x: Stringy[]) => reset(PURPLE, ...x);

const ORANGE = ifColor(`\x1b[38;5;208m`);
export const orange = (...x: Stringy[]) => reset(ORANGE, ...x); // FIXME

export const gray = (depth: number, x: Stringy) => reset(GRAY(depth), x);
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
