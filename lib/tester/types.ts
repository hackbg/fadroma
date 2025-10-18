import type { Info, Write } from '@hackbg/fadroma';
export type MaybeAsync<T> = T|Promise<T>;
export type Categorized<T> = Record<Category, T>;
export type Category = 'pass'|'fail'|'todo'|'warn';
export type Tracker  = (t0: number, summary: string, ...extra: unknown[])=>void;
export type Results  = Result[] & Info & { icon: string, add: Tracker };
export type Result   = { t0?: number, tD?: number, summary: string, details: unknown[] };
export type Options  = { file: string|URL, argv: string[], failFast?: boolean, output: Write, report?: Report };
export type Item     = { t0?: number, id: [], label: [] };
export type Report   = Categorized<Results> & Info & { context (_?: Partial<Context>): Context };
export type Step<T>  = { stack?: string[] } & ((context: Context) => MaybeAsync<T>);
export type Context  = Categorized<Tracker> & Item & {
  track <T> (count: number|null, label: string|null, callback: Step<T>): MaybeAsync<T>;
};
