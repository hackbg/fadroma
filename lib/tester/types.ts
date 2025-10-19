import type { Info, MaybeAsync } from './deps.ts';

/** Names of test result categories. */
export type Category = 'pass'|'fail'|'todo'|'warn';

/** Something grouped by category name. */
export type ByCategory<T> = Record<Category, T>;

/** Can obtain updated context. */
export type GetContext = { getContext (_?: Partial<Context>): Context };

/** The test report. */
export type Report = ByCategory<Results>& GetContext & Info;

/** Start time and duration. */
export type Timed = { t0?: number, tD?: number };

/** A test step. */
export type Step<T> = { stack?: string[]
                      , steps?: unknown[] } & ((context: Context) => MaybeAsync<T>);

/** The result of a test step. */
export type Result = { summary: string|null, details: unknown[] } & Timed;

/** Collection of results for a given category. */
export type Results = { icon: string, add: Add } & Result[] & Info;

/** The test context for a step. */
export type Context = { failFast?:   boolean
                      , failOnTodo?: boolean
                      , /** Breadcrumb of parent step indexes. */
                        ids:         number[]
                      , /** Breadcrumb of parent step names. */
                       names:       string[]
                     , /** Execute a test step and categorize the result. */
                       track:       Track } & ByCategory<Add> & GetContext & Timed;

/** Track the status of a leaf of the test tree. */
export type Track = <T>(id: number|null, name: string|null, callback: Step<T>)
  => MaybeAsync<T>;

/** Add a result to a category. */
export type Add = (t0: number, summary: string|null, ...extra: unknown[])
  => void;
