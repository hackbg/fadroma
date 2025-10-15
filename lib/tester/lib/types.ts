import type { Info, Write } from '../../core/index.ts';
export type Categorized<T> = Record<Category, T>;
export type Category = 'pass'|'fail'|'todo'|'warn';
export type Tracker  = (t0, summary, ...extra: unknown[])=>void;
export type Results  = Array<[string, ...unknown[]]> & Info & { icon: string, add: Tracker };
export type Context  = Categorized<Tracker> & { count: string|null, prefix: string|null };
export type Report   = Categorized<Results> & Info & { context (): Context };
export type Options  = { file: string|URL, argv: string[], failFast?: boolean, output: Write };
