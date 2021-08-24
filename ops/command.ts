import { Taskmaster } from './types'
import { decode } from './system'

import * as repl from 'repl'
import * as vm from 'vm'
import { cwd } from 'process'
import { relative } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

import { backOff } from "exponential-backoff"

import { render } from 'prettyjson'
export { render }

import prompts from 'prompts'
export { prompts }

import colors from 'colors'

const { bold } = colors
export { colors, bold }

// Console /////////////////////////////////////////////////////////////////////////////////////////

/** Prettier console. */
export const Console = (context: string) => {
  context = relative(cwd(), fileURLToPath(context))
  const format = (arg:any) =>
    '\n'+((typeof arg === 'object') ? render(arg) : arg)
  return {
    context, format,
    table: (rows: any) => console.log(table(rows)),
    info:  (...args: any) => console.info('ℹ️ ', ...args),
    log:   (...args: any) => console.log(...args),
    warn:  (...args: any) => console.warn('⚠️ ', ...args),
    error: (...args: any) => console.error('🦋', ...args),
    trace: (...args: any) => console.trace('🦋', ...args),
    debug: (...args: any) => {
      if (!process.env.NO_DEBUG) {
        console.debug('\n' + colors.yellow(`[${context}]`),
                      ...args.map(format)) }
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
        .reduce((x:any,y:any)=>(x||0)+(y||0), 0)
      rows.push(["", '**total**', sum(2), sum(3), sum(4)]) },
    write (file:any) {
      this.total()
      const data = rows.filter(Boolean).map(row=>`| `+row.join(' | ')+` |`).join('\n')
      return writeFile(file, data, 'utf8') } } }

import { table, getBorderCharacters } from 'table'
export { table, getBorderCharacters }
export const noBorders = {
  border: getBorderCharacters('void'),
  columnDefault: { paddingLeft: 0, paddingRight: 2 },
  drawHorizontalLine: () => false }

// Commands ////////////////////////////////////////////////////////////////////////////////////////

export async function runCommand (
  context: any, commands: any, commandToRun: any, ...args: Array<any>
) {
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

export function printUsage (context: any, commands: any) {
  const prefix = context.command.length > 0 ? ((context.command||[]).join(' ')) : ''
  console.log(`\nsienna ${prefix}[COMMAND...]\n`)
  const tableData = collectUsage(context, commands)
  process.stdout.write(table(tableData, noBorders)) }

function collectUsage (
  context = {}, commands: any, tableData = [], visited = new Set(), depth = 0
) {
  const maxDepth = -1 // increment to display command tree in depth
  const indent = Array(depth+1).join('  ')
  for (const commandSpec of commands) {
    if (!commandSpec) {
      tableData.push(['','',''])
      continue }
    let [command, docstring, _, subcommands] = commandSpec
    if (visited.has(commandSpec)) {
      tableData.push([`  ${indent}${bold(command)}`, '(see above)', '']) }
    else {
      visited.add(commandSpec)
      if (command instanceof Array) command = command.join(', ')
      if (depth > maxDepth && subcommands && subcommands.length > 0) {
        tableData.push([
          `  ${indent}${bold(command)}`,
          docstring, bold(`${subcommands.length} subcommand${subcommands.length>1?'s':''}...`)]) }
      else {
        tableData.push([
          `  ${indent}${bold(command)}`,
          docstring, ''])
        if (subcommands) {
          collectUsage(context, subcommands, tableData, visited, depth+1) } } } }
  tableData.push(['','',''])
  return tableData }

// Taskmaster //////////////////////////////////////////////////////////////////////////////////////

export function taskmaster (options: any = {}): Taskmaster {

  const { say    = console.debug
        , header = []
        , table  = markdownTable(header)
        , output
        , agent
        , afterEach = async function gasCheck (
            t1: Date, info: string, reports=[]
          ) {
            const t2 = +new Date()
            const elapsed = t2 - (+t1)
            say(`🟢 +${elapsed}msec`)
            if (agent && reports.length > 0) {
              const txs      = await Promise.all(reports.map(getTx.bind(null, agent)))
                  , gasTotal = txs.map(x=>Number(((x||{}) as any).gas_used||0)).reduce((x,y)=>x+y, 0)
                  , t3       = +new Date()
              say(`⛽ gas cost: ${gasTotal} uSCRT`)
              say(`🔍 gas check: +${t3-t2}msec`)
              table.push([t1.toISOString(), info, elapsed, gasTotal, t3-t2]) }
            else {
              table.push([t1.toISOString(), info, elapsed]) } } } = options

  return Object.assign(task, { done, parallel })

  async function done () {
    if (output) await table.write(output) }
  async function parallel (info: string, ...tasks: Array<Function>) { // TODO subtotal?
    return await task(info, () => Promise.all(tasks.map(x=>Promise.resolve(x)))) }
  async function task (info: string, operation = (report: Function) => {}) {
    say(`\n👉 ${info}`)
    const t1      = new Date()
        , reports = []
        , report  = r => { reports.push(r); return r }
        , result  = await Promise.resolve(operation(report))
    await afterEach(t1, info, reports)
    return result } }

async function getTx ({API:{restClient}}, tx) {
  return backOff(async ()=>{
    try {
      return await restClient.get(`/txs/${tx}`) }
    catch (e) {
      console.warn(`failed to get info for tx ${tx}`)
      console.debug(e)
      console.info(`retrying...`) } }) }

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

export const say = sayer()

export function muted () {
  return Object.assign((x:any)=>x, { tag: () => muted() }) }

/// Interactive shell with the contracts and connections ///////////////////////////////////////////

export class REPL {
  loop:        repl.REPLServer
  prompt:      string
  context:     Record<string, any>
  historyFile: '.fadroma_repl_history'
  constructor (context: Record<string, any>) {
    this.context = context
    this.prompt = `[${context.chain.chainId}]> ` }
  async run () {
    console.info(`Launching shell...`)
    console.info(`Available entities:`)
    console.info('  ' +
      Object.keys(this.context).join('\n  '))
    this.loop = repl.start({
      prompt: this.prompt,
      eval:   this.evaluate.bind(this)})
    await this.setupHistory()
    Object.assign(this.loop.context, this.context) }
  setupHistory = () => new Promise((resolve, reject)=>
    this.loop.setupHistory(this.historyFile, (err, repl) => {
      if (err) return reject(err)
      resolve(repl)}))
  async evaluate (
    cmd:      string,
    context:  Record<any, any>,
    _:        any,
    callback: Function
  ) {
    try {
      return callback(null, await Promise.resolve(
        vm.runInContext(cmd, context))) }
    catch (e) {
      console.error(e)
      return callback() } }}

/// Command runners ////////////////////////////////////////////////////////////////////////////////

export const clear = () =>
  process.env.TMUX && run('sh', '-c', 'clear && tmux clear-history')

export const cargo = (...args: Array<any>) =>
  run('cargo', '--color=always', ...args)

export const run = (cmd: string, ...args: Array<any>) => {
  process.stderr.write(`\n🏃 running:\n${cmd} ${args.join(' ')}\n\n`)
  return execFileSync(cmd, [...args], {stdio:'inherit'}) }

export const outputOf = (cmd: string, ...args: Array<any>) => {
  process.stderr.write(`\n🏃 running:\n${cmd} ${args.join(' ')}\n\n`)
  return String(execFileSync(cmd, [...args])) }
