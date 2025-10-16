import type { Info, Write } from '@hackbg/fadroma';
export type Categorized<T> = Record<Category, T>;
export type Category = 'pass'|'fail'|'todo'|'warn';
export type Tracker  = (t0: number, summary: string, ...extra: unknown[])=>void;
export type Results  = Array<[string, ...unknown[]]> & Info & { icon: string, add: Tracker };
export type Options  = { file: string|URL, argv: string[], failFast?: boolean, output: Write, report?: Report };
export type Item     = { t0?: number, count: string|null, crumb: string|null };
export type Report   = Categorized<Results> & Info & { context (): Context };
export type Step     = { stack?: string[] } & ((context: Context) => (unknown|Promise<unknown>));
export type Context  = Categorized<Tracker> & Item & {
  track <T> (count: string|null, label: string|null, callback: (_: Context)=>T): T
};
