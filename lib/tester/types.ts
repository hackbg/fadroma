import type { Info, MaybeAsync } from '@hackbg/fadroma';
export type Category = 'pass'|'fail'|'todo'|'warn';
export type Categorized<T> = Record<Category, T>;
export type Add = (t0: number, summary: string|null, ...extra: unknown[])=>void;
export type Timed = { t0?: number, tD?: number };
export type Results = Result[] & Info & { icon: string, add: Add };
/** The test report. */
export type Report = Categorized<Results> & Info & { getContext (_?: Partial<Context>): Context };
/** The test context for a step. */
export type Context = Categorized<Add> & {
  t0?: number,
  /** Breadcrumb of parent step indexes. */
  ids: [],
  /** Breadcrumb of parent step labels. */
  labels: [],
  /** Execute a test step and categorize the result. */
  track <T> (id: number|null, label: string|null, callback: Step<T>): MaybeAsync<T>;
};
/** A test step. */
export type Step<T> = { stack?: string[] } & ((context: Context) => MaybeAsync<T>);
/** The result of a test step. */
export type Result = Timed & { summary: string|null, details: unknown[] };
