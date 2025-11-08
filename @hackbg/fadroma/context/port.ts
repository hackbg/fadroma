import type { Step } from '../index.ts';
import { Error, Named, Pipe } from '../format.ts';
import { Socket } from '../deps.ts';

export type Ports<T = unknown> = { ports: Record<number, T> };

export type Endpoint = { url: URL };

/** Run a service and wait for it to provide a port. */
export function Port <T> (port: number, ...steps: Step<T>[]) {
  return Named(`Port(${port})`, async function bindPort (context = { ports: {} }) {
    context.ports[port] = await Pipe(...steps)(context);
    return context;
  }, { port, steps })
}

/** Define function that will wait for given port to open. */
export function portWait <T> ({
  port,
  host     = '127.0.0.1',
  retries  = 30,
  interval = 300
}) {
  return Named(`TCP(Wait for ${host}:${port})`, async function waitForPort (_?: T) {
    while (retries-- > 0) {
      try {
        const socket = new Socket();
        await new Promise((resolve, reject)=>{
          socket.on('connect', ok);
          socket.on('error', fail);
          function ok () { resolve(null); socket.off('error', fail); }
          function fail (e) { reject(e); socket.off('conenct', ok); }
          socket.connect(port, host);
        });
        socket.destroy();
        return
      } catch (e) {
        //console.error(e.message);
        await new Promise(resolve=>setTimeout(resolve, interval));
      }
    }
    throw new Error(`${port}: timed out`)
  }, { port });
}

//import * as net from 'net'
//import { Console } from '@hackbg/logs'
//const log = new Console(`@hackbg/port`)

//[>* Ports range from 0 to 65535 <]
//export const LAST_PORT: number = 65535

//[>* System ports (which require root to bind to) range from 0 to 1023 <]
//export const LAST_SYSTEM_PORT: number = 1023

/** Set of ports that are marked as reserved.
  * Can check if a port is available.
  * Can return random or incremental free ports,
  * with optional preferred default port. */
//export class PortManager extends Set<number> {

  //[>* Mark a port as reserved. <]
  //reserve (port: string|number): boolean {
    //port = toPortNumber(port)
    //const wasReserved = this.has(port)
    //this.add(port)
    //return wasReserved
  //}

  //[>* Unmark a port as reserved. <]
  //unreserve (port: string|number): boolean {
    //port = toPortNumber(port)
    //const wasReserved = this.has(port)
    //this.delete(port)
    //return wasReserved
  //}

  //[>* Mark a port as reserved, throw if it's already in use. <]
  //async tryReservePort (port: string|number): Promise<boolean> {
    //port = toPortNumber(port)
    //const isInUse = await this.isInUse(port)
    //if (isInUse) throw new Error(`Port is already taken: ${port}`)
    //return this.reserve(port)
  //}

  //[>* Unmark a port as reserved, throw if it's still in use. <]
  //async tryUnreserve (port: string|number): Promise<boolean> {
    //port = toPortNumber(port)
    //const isInUse = await this.isInUse(port)
    //if (isInUse) throw new Error(`Port is still taken: ${port}`)
    //return this.reserve(port)
  //}

  //[>* Return true if port is marked as reserved. <]
  //isReserved (port: string|number): boolean {
    //return this.has(toPortNumber(port))
  //}

  //[>* Return true if port is not marked as reserved. <]
  //isNotReserved (port: string|number): boolean {
    //return !this.has(toPortNumber(port))
  //}

  /** If a port is in use, mark it as reserved and return true.
    * Otherwise unmark it as reserved and return false. */
  //async isInUse (port: string|number): Promise<boolean> {
    //port = toPortNumber(port)
    //const isInUse = await isPortTaken(port)
    //if (isInUse) {
      //this.add(port)
    //} else {
      //this.delete(port)
    //}
    //return isInUse
  //}

  //[>* Return true if port is not in use. <]
  //async isNotInUse (port: string|number): Promise<boolean> {
    //return !(await this.isInUse(port))
  //}

  //[>* Return the preferred port number or the first free port after it. <]
  //async getFreePort (preferred?: string|number, system?: boolean): Promise<number> {
    //// If no preferred port is passed, this works the same as getRandomFreePort
    //if (!preferred) {
      //return this.getRandomFreePort(preferred, system)
    //}
    //// Increment port until a free port is reached
    //let port = toPortNumber(preferred)
    //while (this.isReserved(port) || await this.isInUse(port)) {
      //port++
      //if (port > LAST_PORT) port = (system ? 0 : LAST_SYSTEM_PORT) + 1
    //}
    //// Mark the port as used
    //this.reserve(port)
    //return port
  //}

  //[>* Return the preferred port number or a random free port. <]
  //async getRandomFreePort (preferred?: string|number, system?: boolean): Promise<number> {
    //// Try random ports until one of them is free
    //let port: number = preferred ? toPortNumber(preferred) : getRandomPortNumber()
    //while (this.isReserved(port) || await this.isInUse(port)) {
      //port = getRandomPortNumber()
    //}
    //// Mark the found port as reserved
    //this.reserve(port)
    //return port
  //}

  /** Check whether all ports that are marked as reserved are still reserved.
    * Remove from the set of reserved ports those that are not in use anymore. */
  //async refresh () {

    //// Filter the ports that are still taken from the list of reserved ports
    //const freed = (await Promise.all([...this].map(async port=>{
      //if (await isPortTaken(port)) return null
      //return port
    //}))).filter(x=>x!==null)

    //// Remove ports that are not in use any more from the list of reserved ports
    //for (const port of freed) {
      //if (port) {
        //this.delete(port)
      //}
    //}

  //}

//}

//export default new PortManager()

//export function toPortNumber (port: string|number): number {
  //port = Number(port)
  //if (isNaN(port)) {
    //throw new Error('Port must be a number.')
  //}
  //if (port > LAST_PORT) {
    //throw new Error('Port must be in 0-65535 range.')
  //}
  //return port
//}

//export function isPortTaken (port: number): Promise<boolean> {
  //return new Promise(resolve=>{
    //const server = net.createServer()
    //server.once('error', (e: any) => {
      //if (e.code === 'EADDRINUSE') {
        //resolve(true)
      //}
      //try { server.close() } catch (e) {}
    //})
    //server.once('listening', () => {
      //resolve(false)
      //server.close()
    //})
    //server.listen(port)
  //})
//}

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
//export function freePort (): Promise<number> {
  //return new Promise((ok, fail)=>{
    //let port = 0
    //const server = net.createServer()
    //server.on('listening', () => {
      //port = (server.address() as { port: number }).port
      //server.close()
    //})
    //server.on('close', () => ok(port))
    //server.on('error', fail)
    //server.listen(0, '127.0.0.1')
  //})
//}

/** Get a random port number between 1024 and 65535,
  * (or between 0 and 65535 if you pass `true` to include system ports) */
//export function getRandomPortNumber (system: boolean = false): number {
  //const firstPort = 1 + (system ? 0 : LAST_SYSTEM_PORT)
  //return Math.floor(firstPort + Math.random() * (1 + LAST_PORT - firstPort))
//}

//export { backOff } from 'exponential-backoff'
//export * from './port-endpoint'
//export * from './port-wait'

