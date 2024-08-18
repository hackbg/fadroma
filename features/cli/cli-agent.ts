import { bold, bech32, bech32m, randomBech32m, base16 } from '@hackbg/fadroma'
import CLI from '@hackbg/cmds'

/** Base command line interface for Fadroma Agent. */
export default class AgentCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }

  bech32 = this.command({
    name: 'random-bech32',
    info: 'create a random bech32 address',
    args: 'PREFIX [LENGTH]'
  }, (prefix: string, length: string|number = "20") => {
    if (!prefix) {
      this.log.error(bold('Pass a prefix to generate a bech32 address'))
      process.exit(1)
    }
    if (isNaN(Number(length))) {
      this.log.error(bold(`"${length}" is not a number. Pass a valid length to generate a bech32 address.`))
      process.exit(1)
    }
    this.log
      .log(`${length} byte random bech32:`, bold(randomBech32m(prefix, Number(length))))
  })

  bech32m = this.command({
    name: 'random-bech32m',
    info: 'create a random bech32m address',
    args: 'PREFIX [LENGTH]'
  }, (prefix: string, length: string|number = "20") => {
    if (!prefix) {
      this.log.error(bold('Pass a prefix to generate a bech32m address'))
      process.exit(1)
    }
    if (isNaN(Number(length))) {
      this.log.error(bold(`"${length}" is not a number. Pass a valid length to generate a bech32m address.`))
      process.exit(1)
    }
    this.log
      .log(`${length} byte random bech32m:`, bold(randomBech32m(prefix, Number(length))))
  })

  bech32ToHex = this.command({
    name: 'from-bech32',
    info: 'convert a bech32 address to a hex string',
    args: 'ADDRESS'
  }, (address: string) => {
    if (!address) {
      this.log.error(bold('Pass an address to convert it to hexadecimal.'))
      process.exit(1)
    }
    let prefix, words
    try {
      ;({ prefix, words } = bech32.decode(address))
    } catch (e) {
      this.log.error(bold('Failed to decode this address.'))
      this.log.error((e as any).message)
      process.exit(1)
    }
    this.log
      .info('Prefix:  ', bold(prefix))
      .info('Words:   ', bold(base16.encode(new Uint8Array(words))))
      .log('Original:', bold(base16.encode(new Uint8Array(bech32m.fromWords(words)))))
  })

  bech32mToHex = this.command({
    name: 'from-bech32m',
    info: 'convert a bech32m address to a hex string',
    args: 'ADDRESS'
  }, (address: string) => {
    if (!address) {
      this.log.error(bold('Pass an address to convert it to hexadecimal.'))
      process.exit(1)
    }
    let prefix, words
    try {
      ;({ prefix, words } = bech32m.decode(address))
    } catch (e) {
      this.log.error(bold('Failed to decode this address.'))
      this.log.error((e as any).message)
      process.exit(1)
    }
    this.log
      .info('Prefix:  ', bold(prefix))
      .info('Words:   ', bold(base16.encode(new Uint8Array(words))))
      .log('Original:', bold(base16.encode(new Uint8Array(bech32m.fromWords(words)))))
  })

  hexToBech32 = this.command({
    name: 'to-bech32',
    info: 'convert a hex string to a bech32 address',
    args: 'PREFIX DATA'
  }, (prefix: string, data: string) => {
    if (!prefix) {
      this.log.error(bold('Pass a prefix and a valid hex string to generate bech32'))
      process.exit(1)
    }
    let dataBin
    try {
      dataBin = base16.decode(data.toUpperCase())
    } catch (e) {
      this.log.error(bold('Pass a prefix and a valid hex string to generate bech32'))
      process.exit(1)
    }
    this.log
      .info('input: ', bold(data))
      .log('bech32:', bold(bech32.encode(prefix, bech32.toWords(dataBin))))
  })

  hexToBech32m = this.command({
    name: 'to-bech32m',
    info: 'convert a hex string to a bech32m address',
    args: 'PREFIX DATA'
  }, (prefix: string, data: string) => {
    if (!prefix) {
      this.log.error(bold('Pass a prefix and a valid hex string to generate bech32m'))
      process.exit(1)
    }
    let dataBin
    try {
      dataBin = base16.decode(data.toUpperCase())
    } catch (e) {
      this.log.error(bold('Pass a prefix and a valid hex string to generate bech32m'))
      process.exit(1)
    }
    this.log
      .info('input:  ', bold(data))
      .log('bech32m:', bold(bech32m.encode(prefix, bech32m.toWords(dataBin))))
  })

}


