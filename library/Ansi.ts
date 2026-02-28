/** ANSI colors. */
import type { Str } from '../index.ts';

const { env } = await import('node:process')
  .catch(e=>{ console.warn(e); return { env: {} } });

export const ifColor  = <T>(x: T) => NO_COLOR ? '' : x;
export const escaped  = <T>(x: T) => `\x1b[${x}`;
export const NO_COLOR = env?.NO_COLOR === '1';
export const RESET    = escaped('0m'); // `\x1b[0m`
export const BOLD     = ifColor(escaped('1m'));
export const DIM      = ifColor(escaped('38;5;245m'));
export const RED      = ifColor(escaped(`31m`));
export const GREEN    = ifColor(escaped(`32m`));
export const YELLOW   = ifColor(escaped(`33m`));
export const BLUE     = ifColor(escaped(`34m`));
export const PURPLE   = ifColor(escaped(`35m`));
export const FG255    = (x: number) => ifColor(escaped(`38;5;${x}m`));
export const BG255    = (x: number) => ifColor(escaped(`48;5;${x}m`));
export const ORANGE   = FG255(208);

export const reset  = (...args: unknown[]) => [...args, RESET].join('');
export const fg255  = (x: number) => (text: string) => `\x1b[38;5;${x}m`+`${text}${RESET}`;
export const bg255  = (x: number) => (text: string) => `\x1b[48;5;${x}m`+`${text}${RESET}`;
export const bold   = (...x: Str[]) => reset(BOLD, ...x);
export const dim    = (...x: Str[]) => reset(DIM, ...x);
export const red    = (...x: Str[]) => reset(RED, ...x);
export const green  = (...x: Str[]) => reset(GREEN, ...x);
export const yellow = (...x: Str[]) => reset(YELLOW, ...x);
export const blue   = (...x: Str[]) => reset(BLUE, ...x);
export const purple = (...x: Str[]) => reset(PURPLE, ...x);
export const orange = (...x: Str[]) => reset(ORANGE, ...x); // FIXME

export const gray = (depth: number, x: Str) => reset(GRAY(depth), x);
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
][depth];

// TODO id -> color registry
