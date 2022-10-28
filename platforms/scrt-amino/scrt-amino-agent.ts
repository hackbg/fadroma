import { ScrtAgent } from '@fadroma/scrt'

/** Amino-specific configuration objects for the agent. */
export interface ScrtAminoAgentOpts extends Fadroma.ScrtAgentOpts {
  keyPair: { privkey: Uint8Array }|null
  pen:     SigningPen
}

export class ScrtAminoAgent extends ScrtAgent {

  constructor (options: Partial<ScrtAminoAgentOpts> = {}) {
    super(options)
    this.name     = options?.name || ''
    // @ts-ignore
    this.fees     = options?.fees || Fadroma.Scrt.defaultFees
    this.keyPair  = options?.keyPair
    this.mnemonic = options?.mnemonic
    this.pen      = options?.pen
    if (this.pen) {
      this.pubkey   = SecretJS.encodeSecp256k1Pubkey(options?.pen!.pubkey)
      this.address  = SecretJS.pubkeyToAddress(this.pubkey, 'secret')
      this.sign     = this.pen.sign.bind(this.pen)
      this.seed     = SecretJS.EnigmaUtils.GenerateNewSeed()
    }
  }

  readonly keyPair
  readonly mnemonic
  readonly pen?: SigningPen
  readonly sign
  readonly pubkey
  readonly seed
  initialWait = 1000
  API = PatchedSigningCosmWasmClient_1_2
  get api () {
    if (!this.address) {
      throw new Error("No address, can't get API")
    }
    return new this.API(
      this.assertChain().url,
      this.address,
      this.sign,
      this.seed,
      this.fees,
      SecretJS.BroadcastMode.Sync
    )
  }
  get block () {
    return this.api.getBlock()
  }
  get height () {
    return this.block.then(block=>block.header.height)
  }
  get account () {
    return this.api.getAccount(this.address)
  }
  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (
    denomination: string                    = this.defaultDenom,
    address:      Fadroma.Address|undefined = this.address
  ) {
    const account = await this.api.getAccount(address)
    const balance = account!.balance || []
    const inDenom = ({denom}:{denom: string}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }
  async send (to: Fadroma.Address, amounts: any, opts?: any): Promise<SecretJS.PostTxResult> {
    return await this.api.sendTokens(to, amounts, opts?.memo)
  }
  async sendMany (outputs: any, opts?: any) {
    if (outputs.length < 0) throw new ScrtAminoError.NoRecipients()
    const from_address = this.address
    //const {accountNumber, sequence} = await this.api.getNonce(from_address)
    let accountNumber: number
    let sequence:      number
    const toMsg = async ([to_address, amount]: [Fadroma.Address, Fadroma.Uint128])=>{
      ({accountNumber, sequence} = await this.api.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount}
      return { type: 'cosmos-sdk/MsgSend', value }
    }
    const msg = await Promise.all(outputs.map(toMsg))
    const memo      = opts?.memo
    const fee       = opts?.fee || Fadroma.Scrt.gas(500000 * outputs.length)
    const chainId   = this.assertChain().id
    const signBytes = SecretJS.makeSignBytes(msg, fee, chainId, memo, accountNumber!, sequence!)
    return this.api.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }
  async upload (data: Uint8Array): Promise<Fadroma.Contract<any>> {
    if (!(data instanceof Uint8Array)) throw new ScrtAminoError.NoUploadBinary()
    const uploadResult = await this.api.upload(data, {})
    let codeId = String(uploadResult.codeId)
    if (codeId === "-1") codeId = uploadResult.logs[0].events[0].attributes[3].value
    return Object.assign(new Fadroma.Contract(), {
      artifact: undefined,
      codeHash: uploadResult.originalChecksum,
      chainId:  this.assertChain().id,
      codeId,
      uploadTx: uploadResult.transactionHash
    })
  }
  async instantiate (
    template: Fadroma.Contract<any>,
    label:    string,
    msg:      Fadroma.Message,
    funds = []
  ): Promise<Fadroma.Contract<any>> {
    if (!template.codeHash) throw new ScrtAminoError.NoCodeHashInTemplate()
    let { codeId, codeHash } = template
    const { api } = this
    //@ts-ignore
    const { logs, transactionHash } = await api.instantiate(Number(codeId), msg, label, funds)
    const address = logs![0].events[0].attributes[4].value
    codeId = String(codeId)
    const initTx = transactionHash
    return Object.assign(new Fadroma.Contract(template), { address, codeHash })
  }
  async getHash (idOrAddr: number|string): Promise<Fadroma.CodeHash> {
    const { api } = this
    if (typeof idOrAddr === 'number') {
      return await api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }
  async getCodeId (address: Fadroma.Address): Promise<Fadroma.CodeId> {
    return String((await this.api.getContract(address)).codeId)
  }
  async getLabel (address: Fadroma.Address): Promise<Fadroma.Label> {
    return (await this.api.getContract(address)).label
  }
  async query <U> (
    { address, codeHash }: Partial<Fadroma.Client>, msg: Fadroma.Message
  ): Promise<U> {
    return await this.api.queryContractSmart(address!, msg as object, undefined, codeHash)
  }
  async execute (
    { address, codeHash }: Partial<Fadroma.Client>, msg: Fadroma.Message,
    opts: Fadroma.ExecOpts = {}
  ): Promise<SecretJS.TxsResponse> {
    const { memo, send, fee } = opts
    return await this.api.execute(address, msg, memo, send, fee, codeHash)
  }
  async encrypt (codeHash: Fadroma.CodeHash, msg: Fadroma.Message) {
    if (!codeHash) throw new ScrtAminoError.NoCodeHash()
    const encrypted = await this.api.restClient.enigmautils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }
  async signTx (msgs: any[], gas: Fadroma.IFee, memo: string = '') {
    const { accountNumber, sequence } = await this.api.getNonce()
    return await this.api.signAdapter(
      msgs,
      gas,
      this.assertChain().id,
      memo,
      accountNumber,
      sequence
    )
  }
  async getNonce () {
    const { accountNumber, sequence } = await this.api.getNonce()
    return { accountNumber, sequence }
  }
}
