declare module '@fadroma/client-scrt-amino' {

  /** This is the latest version of the SigningCosmWasmClient async broadcast/retry patch. */

  import { SigningCosmWasmClient, BroadcastMode, InstantiateResult, ExecuteResult } from 'secretjs'

  export class PatchedSigningCosmWasmClient_1_2 extends SigningCosmWasmClient {

    private _queryUrl: string

    private _queryClient: any

    get queryClient ()

    get (path: string): Promise<any>

    submitRetries:      number

    resultSubmitDelay:  number

    blockQueryInterval: number

    resultRetries:      number

    resultRetryDelay:   number

    instantiate (codeId, initMsg, label, memo?, transferAmount?, fee?, hash?): Promise<InstantiateResult>

    execute (contractAddress, handleMsg, memo?, transferAmount?, fee?, contractCodeHash?): Promise<ExecuteResult>

    waitForNextBlock (sent: number): Promise<void>

    waitForNextNonce (sent: number): Promise<void>

    postTx (tx: any): Promise<any>

    getTxResult (id: string): Promise<any>

    private shouldRetry (message: string, isActuallyOk?: boolean): boolean

  }

  function parseAxiosError (err: any): never

}
