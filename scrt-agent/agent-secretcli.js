import { execFile } from 'child_process'
import { promisify } from 'util'

const secretcli = (...args) => new Promise((resolve, reject)=>{
  execFile('secretcli', args, (err, stdout, stderr) => {
    if (err) return reject(err)
    return JSON.parse(String(stdout))
  })
})

export default class SecretCLIAgent {

  constructor (options = {}) {
    const { name, address } = options
    this.nameOrAddress = this.name || this.address
  }

  get nextBlock () {
    return this.block.then(async T1=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const {sync_info:{latest_block_height:T2}} = await this.block
        if (T2 > T1) return
      }
    })
  }

  get block () {
    return secretcli('status').then(({sync_info:{latest_block_height:T2}})=>T2)
  }

  get account () {
    return secretcli('q', 'account', this.nameOrAddress)
  }

  get balance () {
    return this.getBalance('uscrt')
  }

  async getBalance (denomination) {
    return (this.account.value.coins.filter(x=>x.denom===denomination)[0]||{}).amount
  }

  async send (recipient, amount, denom = 'uscrt', memo = '') {
    throw new Error('not implemented')
  }

  async sendMany (txs = [], memo = '', denom = 'uscrt', fee) {
    throw new Error('not implemented')
  }

  async upload (pathToBinary) {
    return secretcli(
      'tx', 'compute', 'store',
      pathToBinary,
      '--from', this.nameOrAddress
    )
  }

  async instantiate (pathToBinary) {
    const { codeId, initMsg = {}, label = '' } = instance
    instance.agent = this
    debug(`⭕`+bold('init'), { codeId, label, initMsg })
    const initTx = instance.initTx = await secretcli(
      'tx', 'compute', 'instantiate',
      codeId, JSON.stringify(initMsg),
      '--label', label,
      '--from', this.nameOrAddress
    )
    debug(`⭕`+bold('instantiated'), { codeId, label, initTx })
    instance.codeHash = await secretcli('q', 'compute', 'contract-hash', initTx.contractAddress)
    await instance.save()
    return instance
  }

  async query ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    debug(`❔ `+bold('query'), { label, address, method, args })
    const response = await secretcli(
      'q', 'compute', 'query',
      address, JSON.stringify(msg),
    )
    debug(`❔ `+bold('response'), { address, method, response })
    return response
  }

  async execute ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    debug(`❗ `+bold('execute'), { label, address, method, args })
    const result = await secretcli(
      'tx', 'compute',
      address, JSON.stringify(msg),
      '--from', this.nameOrAddress
    )
    debug(`❗ `+bold('result'), { label, address, method, result })
    return result
  }

}
