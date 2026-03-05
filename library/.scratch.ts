
//const stdoutRe = (re: RegExp) =>
  //({ stdout }: { stdout: string }) => stdout.match(re)[1];

///** A collection of processes and network endpoints provided by them. */
//export type Service = Dir & Ports<number> & {
//  /** Processes comprising the service, by PID. */
//  pids: Record<number, ChildProcess>;
//  /** Terminate the service. */
//  kill: Fn<[], Fn.Async>;
//};
///** Define a service. */
//export function Service <S extends Service> (
//  name: string, ...services: Fn<[S]>[]
//) {
//  const info = `[Service (${services.length}): ${name}]`;
//  return toString(info)(Fn.Name(name, runService, { services }));
//  async function runService (
//    ctx = { ...Dir(), pids: {}, ports: {} } as Partial<S>
//  ): Promise<S> {
//    for (const service of services) await service(ctx);
//    const kill = () => Promise.all(Object.values(ctx.pids).map(proc=>proc.kill()));
//    return Object.assign(ctx, { kill, }) as unknown as S;
//  }
//}

