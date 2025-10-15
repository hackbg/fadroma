/** A raw response from an endpoint. */
export type Response = {
  /** The query that was made. */
  url?:       string,
  /** The data that was returned, which may be invalid (e.g. a 502) */
  data?:      string
  /** The moment the query was made. */
  timestamp?: string,
};

/** A valid JSON-RPC v2 response, which may be a result or an error. */
export type JsonRpcResponse<R> = {
  jsonrpc: string, id: number, result?: R, error?: { data: string }
};

/** A parse that may fail but the source and error must still be preserved. */
export type TryToParse<T, U> = [T, U, undefined] | [T, undefined, unknown];

export const tryToParse = <T, U>(src: T): TryToParse<T, U> => {
  try {
    const json = JSON.parse(src as string)
    return [src, json, undefined]
  } catch (e) {
    return [src, undefined, e]
  }
};
