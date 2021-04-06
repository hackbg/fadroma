import { backOff } from "exponential-backoff"
import tabulate from './table.js'

export default function taskmaster ({
  say    = console.debug,

  header = [],
  table  = tabulate(header),
  output,

  agent,
  afterEach = async (t1, description, reports=[]) => {
    const t2 = new Date()
    say(`⏱️  took ${t2-t1}msec`)
    if (agent && reports.length > 0) {
      const txs = await Promise.all(reports.map(getTx.bind(null, agent)))
      const totalGasUsed = txs.map(x=>Number(x.gas_used)).reduce((x,y)=>x+y, 0)
      const t3 = new Date()
      say(`⛽ cost ${totalGasUsed} gas`)
      say(`🔍 gas check took ${t3-t2}msec`)
      table.push([t1.toISOString(), description, t2-t1, totalGasUsed, t3-t2])
    } else {
      table.push([t1.toISOString(), description, t2-t1])
    }
  }

}={}) {

  return Object.assign(task, { done, parallel })

  async function done () {
    if (output) await table.write(output)
  }

  async function parallel (description, ...tasks) { // TODO subtotal?
    return await task(description, () => Promise.all(tasks.map(x=>Promise.resolve(x))))
  }

  async function task (description, operation = () => {}) {
    const t1      = new Date()
    say(`\n${description}`)
    const reports = []
    const report  = r => { reports.push(r); return r }
    const result  = await Promise.resolve(operation(report))
    await afterEach(t1, description, reports)
    return result
  }

}

async function getTx ({API:{restClient}}, tx) {
  return backOff(async ()=>{
    try {
      return await restClient.get(`/txs/${tx}`)
    } catch (e) {
      console.warn(`failed to get tx info: ${e.message}`)
      console.debug('retrying...')
      throw e
    }
  })
}
