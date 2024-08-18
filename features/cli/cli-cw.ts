import { bold } from '@hackbg/fadroma'
import CLI from '@hackbg/cmds'
import * as CW from '@fadroma/cw'

export default class CWCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }

  archway   = this.commands('archway',   'commands for Archway',   new CW.Archway.CLI())
  axelar    = this.commands('axelar',    'commands for Axelar',    new CW.Axelar.CLI())
  injective = this.commands('injective', 'commands for Injective', new CW.Injective.CLI())
  okp4      = this.commands('okp4',      'commands for OKP4',      new CW.OKP4.CLI())
  osmosis   = this.commands('osmosis',   'commands for Osmosis',   new CW.Osmosis.CLI())

  check = this.command({
    name: 'check',
    info: 'check if there is a working RPC endpoint at a given URL',
    args: 'RPC_URL [TIMEOUT_SEC]'
  }, async (url: string, timeout: number = 5) => {
    if (!url) {
      this.log.error(bold('Pass a RPC URL to connect.'))
      process.exit(1)
    }
    const connection = await CW.connect({ url })
    this.log.info(`Will exit with error code if not connected in ${timeout}s.`)
    const timer = setTimeout(()=>{
      this.log.error(`Failed to connect in ${timeout}s.`)
      process.exit(1)
    }, timeout * 1000)
    let api
    try {
      api = await connection.api
    } catch (e) {
      this.log.error(e.stack)
      this.log.error(bold(`Failed to connect because of the above error.`))
      process.exit(1)
    }
    clearTimeout(timer)
    this.log.log(api)
    this.log.log('Connected successfully.')
  })

}
