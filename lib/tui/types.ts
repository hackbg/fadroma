export type TuiState = {
  exited: boolean,
  width:  number,
  height: number,
  input: { [Symbol.asyncIterator] (): AsyncIterator<string|Uint8Array> },
  cursorTo (x: number, y: number): void
  write (_: string): void
} & FrameTimings;

export type FrameTimings = {
  t0: number,
  t1: number,
  tF: number,
  tD: number,
  tS: number,
}
