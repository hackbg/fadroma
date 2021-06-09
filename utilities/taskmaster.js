import { backOff } from "exponential-backoff"
import tabulate from './table.js'

export default function taskmaster (options={}) {

  const { say    = console.debug
        , header = []
        , table  = tabulate(header)
        , output
        , agent
        , afterEach = async function gasCheck (t1, description, reports=[]) {
            const t2 = new Date()
            say(`🟢 +${t2-t1}msec`)
            if (agent && reports.length > 0) {
              const txs          = await Promise.all(reports.map(getTx.bind(null, agent)))
                  , totalGasUsed = txs.map(x=>Number(x||{}.gas_used||0)).reduce((x,y)=>x+y, 0)
                  , t3           = new Date()
              say(`⛽ gas cost: ${totalGasUsed} uSCRT`)
              say(`🔍 gas check: +${t3-t2}msec`)
              table.push([t1.toISOString(), description, t2-t1, totalGasUsed, t3-t2])
            } else {
              table.push([t1.toISOString(), description, t2-t1])
            }
          }
        } = options

  return Object.assign(task, { done, parallel })

  async function done () {
    if (output) await table.write(output)
  }

  async function parallel (description, ...tasks) { // TODO subtotal?
    return await task(description, () => Promise.all(tasks.map(x=>Promise.resolve(x))))
  }

  async function task (description, operation = () => {}) {
    say(`\n👉 ${description}`)
    const t1      = new Date()
        , reports = []
        , report  = r => { reports.push(r); return r }
        , result  = await Promise.resolve(operation(report))
    await afterEach(t1, description, reports)
    return result
  }

}

async function getTx ({API:{restClient}}, tx) {
  return backOff(async ()=>{
    try {
      return await restClient.get(`/txs/${tx}`)
    } catch (e) {
      console.warn(`failed to get info for tx ${tx}`)
      console.debug(e)
      console.info(`retrying...`)
    }
  })
}
