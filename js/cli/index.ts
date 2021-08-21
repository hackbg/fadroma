import { cwd } from 'process'
import { relative } from 'path'
import { fileURLToPath } from 'url'
import { render } from 'prettyjson'
import colors from 'colors'
import { decode } from '@fadroma/sys'

const { bold } = colors
export { colors, bold }

// Console /////////////////////////////////////////////////////////////////////////////////////////

/** Prettier console. */
export const Console = filename => {
  filename = relative(cwd(), fileURLToPath(filename))
  const format = arg => '\n'+((typeof arg === 'object') ? render(arg) : arg)
  return {
    filename,
    format,
    table: rows      => console.log(table(rows)),
    info:  (...args) => console.info('ℹ️ ', ...args),
    log:   (...args) => console.log(...args),
    warn:  (...args) => console.warn('⚠️ ', ...args),
    error: (...args) => console.error('🦋', ...args),
    debug: (...args) => {
      if (!process.env.NODEBUG) {
        console.debug('\n' + colors.yellow(filename), ...args.map(format)) }
      return args[0] } } }

// Table ///////////////////////////////////////////////////////////////////////////////////////////

import { writeFile } from 'fs/promises'

export function markdownTable (header: Array<string>) {
  const rows = [ header, header.map((()=>'---')) ]
  return {
    push (row:any) {
      rows.push(row) },
    total () {
      const sum = (col:any) => rows
        .slice(2)
        .map(x=>x[col])
        .reduce((x,y)=>(x||0)+(y||0), 0)
      rows.push(["", '**total**', sum(2), sum(3), sum(4)]) },
    write (file:any) {
      this.total()
      const data = rows.filter(Boolean).map(row=>`| `+row.join(' | ')+` |`).join('\n')
      return writeFile(file, data, 'utf8') } } }

export { table, getBorderCharacters } from 'table'
import { getBorderCharacters } from 'table'
export const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false }

// Commands ////////////////////////////////////////////////////////////////////////////////////////

export async function runCommand (context, commands, commandToRun, ...args) {
  if (commandToRun) {
    let notFound = true
    for (const command of commands.filter(Boolean)) {
      if (!command) continue
      const [nameOrNames, info, fn, subcommands] = command
          , singleMatch = (typeof nameOrNames === 'string' && nameOrNames === commandToRun)
          , multiMatch  = (nameOrNames instanceof Array && nameOrNames.indexOf(commandToRun) > -1)
      if (singleMatch || multiMatch) {
        notFound = false
        let notImplemented = true
        if (fn) {
          // allow subcommands to add to the context by returning an updated value
          // but preserve it if they return nothing (they can still mutate it)
          context = await Promise.resolve(fn(context, ...args)) || context
          notImplemented = false }
        if (subcommands && subcommands.length > 0) {
          context.command.push(args[0])
          runCommand(context, subcommands, args[0], ...args.slice(1))
          notImplemented = false }
        if (notImplemented) {
          console.warn(`${commandToRun}: not implemented`) } } }
    if (notFound) {
      console.warn(`${commandToRun}: no such command`) } }
  else {
    printUsage(context, commands) } }

export function printUsage (context, commands) {
  const prefix = context.command.length > 0 ? ((context.command||[]).join(' ')) : ''
  console.log(`\nsienna ${prefix}[COMMAND...]\n`)
  const tableData = collectUsage(context, commands)
  process.stdout.write(table(tableData, noBorders)) }

function collectUsage (context = {}, commands, tableData = [], visited = new Set(), depth = 0) {
  const maxDepth = -1 // increment to display command tree in depth
  const indent = Array(depth+1).join('  ')
  for (const commandSpec of commands) {
    if (!commandSpec) {
      tableData.push(['','',''])
      continue }
    let [command, docstring, fn, subcommands] = commandSpec
    if (visited.has(commandSpec)) {
      tableData.push([`  ${indent}${bold(command)}`, '(see above)', '']) }
    else {
      visited.add(commandSpec)
      if (command instanceof Array) command = command.join(', ')
      if (depth > maxDepth && subcommands && subcommands.length > 0) {
        tableData.push([`  ${indent}${bold(command)}`, docstring, bold(`(${subcommands.length} commands)`)]) }
      else {
        tableData.push([`  ${indent}${bold(command)}`, docstring, ''])
        if (subcommands) {
          collectUsage(context, subcommands, tableData, visited, depth+1) } } } }
  return tableData }

// Taskmaster //////////////////////////////////////////////////////////////////////////////////////

import { backOff } from "exponential-backoff"
import { markdownTable } from './table'

export function taskmaster (options={}) {

  const { say    = console.debug
        , header = []
        , table  = markdownTable(header)
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

/// https://en.wikipedia.org/wiki/Pointing_and_calling /////////////////////////////////////////////

export function sayer (prefixes = []) {
  return Object.assign(say, { tag })
  function say (x: any = {}) {
    const prefix = `#` + prefixes.map(renderPrefix).join(` #`)
    if (x instanceof Object) {
      if (x.data instanceof Uint8Array) {
        x.data = decode(x.data) }
      console.log(colors.yellow(`${prefix}`))
      if (Object.keys(x).length > 0) {
        console.log(render(x)) } }
    else {
      console.log(colors.yellow(`${prefix}`), render(x)) }
    return x }
  function tag (x: any) {
    return sayer([...prefixes, x]) }
  function renderPrefix (x: any) {
    if (x instanceof Function) {
      return x() }
    else {
      return x } } }

const say = sayer()

export default say

export function muted () {
  return Object.assign(x=>x, {
    tag: () => muted()
  })
}

