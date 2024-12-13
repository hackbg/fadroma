export async function timed <T> (
  fn: ()=>Promise<T>, cb: (ctx: { elapsed: string, result: T })=>unknown
): Promise<T> {
  const t0 = performance.now()
  const result = await fn()
  const t1 = performance.now()
  cb({
    elapsed: ((t1-t0)/1000).toFixed(3)+'s',
    result
  })
  return result as T
}

export async function optionallyParallel <T> (parallel: boolean|undefined, thunks: Array<()=>Promise<T>>) {
  if (parallel) {
    return await Promise.all(thunks.map(thunk=>thunk()))
  }
  const results = []
  for (const thunk of thunks) {
    results.push(await thunk())
  }
  return results
}
