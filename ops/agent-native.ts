import { Agent } from './agent'
import { Chain } from './chain'
import { Console, bold } from './cli-kit'

import { execFile, spawn } from 'child_process'

const {warn, debug} = Console(import.meta.url)

const secretcli = (...args: Array<any>): Promise<any> => new Promise(
  (resolve, reject)=>{
    execFile('secretcli', args, (err: any, stdout: any) => {
      if (err) return reject(err)
      resolve(JSON.parse(String(stdout))) }) })

const tryToUnlockKeyring = async () => new Promise(
  (resolve, reject)=>{
    warn("Pretending to add a key in order to refresh the keyring...")
    const unlock = spawn('secretcli', ['keys', 'add'])
    unlock.on('spawn', () => {
      unlock.on('close', resolve)
      setTimeout(()=>{ unlock.kill() }, 1000) })
    unlock.on('error', reject) })

export class CLIAgent implements Agent {

  network: Chain

  name: string
  address: string
  nameOrAddress: string

  fees: any

  static async pick () {
    if (!process.stdin.isTTY) {
      throw new Error("Input is not a TTY - can't interactively pick an identity") }
    let keys = (await secretcli('keys', 'list'))
    if (keys.length < 1) {
      warn("Empty key list returned from secretcli. Retrying once:")
      await tryToUnlockKeyring()
      keys = (await secretcli('keys', 'list'))
      if (keys.length < 1) {
        warn(
          "Still empty. To proceed, add your key to secretcli " +
          "(or set the mnemonic in the environment to use the SecretJS-based agent)") } } }

  constructor (options: any = {}) {
    debug({options})
    const { name, address } = options
    this.name = name
    this.address = address
    this.nameOrAddress = this.name || this.address }

  get nextBlock () {
    return this.block.then(async T1=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const {sync_info:{latest_block_height:T2}} = await this.block
        if (T2 > T1) return } }) }

  get block () {
    return secretcli('status').then(({sync_info:{latest_block_height:T2}})=>T2) }

  get account () {
    return secretcli('q', 'account', this.nameOrAddress) }

  get balance () {
    return this.getBalance('uscrt') }

  async getBalance (denomination: string) {
    return ((await this.account).value.coins.filter(x=>x.denom===denomination)[0]||{}).amount }

  async send (recipient, amount, denom = 'uscrt', memo = '') {
    throw new Error('not implemented') }

  async sendMany (txs = [], memo = '', denom = 'uscrt', fee) {
    throw new Error('not implemented') }

  async upload (pathToBinary: string) {
    return secretcli(
      'tx', 'compute', 'store',
      pathToBinary,
      '--from', this.nameOrAddress ) }

  async instantiate (instance: any) {
    const { codeId, initMsg = {}, label = '' } = instance
    instance.agent = this
    debug(`⭕`+bold('init'), { codeId, label, initMsg })
    const initTx = instance.initTx = await secretcli(
      'tx', 'compute', 'instantiate',
      codeId, JSON.stringify(initMsg),
      '--label', label,
      '--from', this.nameOrAddress)
    debug(`⭕`+bold('instantiated'), { codeId, label, initTx })
    instance.codeHash = await secretcli('q', 'compute', 'contract-hash', initTx.contractAddress)
    await instance.save()
    return instance }

  async query ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    debug(`❔ `+bold('query'), { label, address, method, args })
    const response = await secretcli(
      'q', 'compute', 'query',
      address, JSON.stringify(msg),
    )
    debug(`❔ `+bold('response'), { address, method, response })
    return response }

  async execute ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    debug(`❗ `+bold('execute'), { label, address, method, args })
    const result = await secretcli(
      'tx', 'compute',
      address, JSON.stringify(msg),
      '--from', this.nameOrAddress
    )
    debug(`❗ `+bold('result'), { label, address, method, result })
    return result } }

