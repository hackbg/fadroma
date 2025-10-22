import type { Step, StepsWithName } from './index.ts';
import type { TcpServer } from './deps.ts';

export * from './backend/dom.ts';
export * from './backend/fs.ts';
export * from './backend/net.ts';
export * from './backend/oci.ts';
export * from './backend/proc.ts';
export * from './backend/service.ts';
export * from './backend/timers.ts';

/** Context for executing filesystem operations. */
export type FS = {
  /** Current working directory */
  cwd: string
  /** Paths touched by FS ops. */
  paths: Record<string, unknown>
};

/** A filesystem operation. Needs current working directory. */
export type FSOp = (_: FS) => FS;

export type Net = { ports: Record<number, TcpServer> };

export type Router = { url?: string, method?: string, body?: string };

export type Route = StepsWithName<Router>;

export type Handler = Step<Router>;
