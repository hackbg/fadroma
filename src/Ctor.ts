/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
import type { Into } from './Util'
import type {
  Address, Uint128, ChainId, CodeId, Token, Message,
  Chain, Connection, Agent, Batch, Identity, SigningConnection, Transaction, Block
} from './API'
import { assign, timed, bold, Logged, into, Error } from './Util'
import { execute } from './impl/execute'
import { fetchBalance } from './impl/fetchBalance'
import { fetchBlock } from './impl/fetchBlock'
import { fetchCodeInfo } from './impl/fetchCodeInfo'
import { fetchCodeInstances } from './impl/fetchCodeInstances'
import { fetchContractInfo } from './impl/fetchContractInfo'
import { fetchNextBlock } from './impl/fetchNextBlock'
import { instantiate } from './impl/instantiate'
import { query } from './impl/query'
import { send } from './impl/send'
import { upload } from './impl/upload'

/** Adds a `stub` flag to an object. The stub flag is used to determine
  * whether unimplemented methods throw or return dummy valies. */
type Stubbable<T> = { stub?: boolean } & T

export function makeChain ({
  stub, id
}: Stubbable<Pick<Chain, 'id'>>): Chain {
  return {
    get id () {
      return id
    },
    fetchHeight () {
      this.log.debug('Querying block height')
      return this.getConnection().fetchHeightImpl()
    },
    fetchNextBlock () {
      this.log.debug('Querying block height')
      return fetchNextBlock(this)
    },
    fetchBlock (...args) {
      return fetchBlock(this, ...args as Parameters<Chain["fetchBlock"]>)
    },
    fetchBalance (...args) {
      return fetchBalance(this, ...args as Parameters<Chain["fetchBalance"]>)
    },
    fetchCodeInfo (...args) {
      return fetchCodeInfo(this, ...args as Parameters<Chain["fetchCodeInfo"]>)
    },
    fetchCodeInstances (...args) {
      return fetchCodeInstances(this, ...args as Parameters<Chain["fetchCodeInstances"]>)
    },
    fetchContractInfo (...args) {
      return fetchContractInfo(this, ...args as Parameters<Chain["fetchContractInfo"]>)
    },
    query (...args) {
      return query(this, ...args as Parameters<Chain["query"]>)
    },
    ...stub ? {
      getConnection () {
        return {}
      },
      authenticate () {
        return {}
      },
    } : {
      getConnection () {
        throw Error.Unimplemented()
      },
      authenticate () {
        throw Error.Unimplemented()
      },
    }
  }
}

export function makeConnection ({ stub }: Stubbable<{}>): Connection {
  /** FIXME: find these guys a new home:
   *
    constructor (
      properties: ConstructorParameters<typeof Logged>[0]
        & Pick<Connection, 'chain'|'url'>
        & Partial<Pick<Connection, 'alive'>>
    ) {
      super(properties)
      this.#chain = properties.chain
      this.url    = properties.url
      this.alive  = properties.alive ?? true
      this.log.label = [
        this.constructor.name,
        '(', this[Symbol.toStringTag] ? `(${bold(this[Symbol.toStringTag])})` : null, ')'
      ].filter(Boolean).join('')
      this.log.label = new.target.constructor.name
      const chainColor = randomColor({ luminosity: 'dark', seed: this.url })
      this.log.label = colors.bgHex(chainColor).whiteBright(` ${this.url} `)
    }
    get [Symbol.toStringTag] () {
      if (this.url) {
        const color = randomColor({ luminosity: 'dark', seed: this.url })
        return colors.bgHex(color).whiteBright(this.url)
      }
    } */
  return {
    get chain () {
      return chain
    },
    get url () {
      return url
    },
    get alive () {
      return true
    },
    ...stub ? {
      fetchBlockImpl () {
        return {}
      },
      fetchHeightImpl () {
        return {}
      },
      fetchBalanceImpl () {
        return {}
      },
      fetchCodeInfoImpl () {
        return {}
      },
      fetchCodeInstancesImpl () {
        return {}
      },
      fetchContractInfoImpl () {
        return {}
      },
      queryImpl () {
        return {}
      },
    } : {
      fetchBlockImpl () {
        throw Error.Unimplemented()
      },
      fetchHeightImpl () {
        throw Error.Unimplemented()
      },
      fetchBalanceImpl () {
        throw Error.Unimplemented()
      },
      fetchCodeInfoImpl () {
        throw Error.Unimplemented()
      },
      fetchCodeInstancesImpl () {
        throw Error.Unimplemented()
      },
      fetchContractInfoImpl () {
        throw Error.Unimplemented()
      },
      queryImpl () {
        throw Error.Unimplemented()
      },
    }
  }
}

export function makeBlock ({
  chain, hash, height, header, transactions
}: Pick<Block, 'hash'|'chain'|'header'|'height'|'transactions'>): Block {
  return {
    get chain () { return chain },
    get chainId () { return chain.id },
    get hash () { return hash },
    get id () { return hash },
    get height () { return height },
    get header () { return header },
    get transactions () { return transactions }
  }
}

export function makeTransaction ({
  block, hash, data
}: Pick<Transaction, 'hash'|'block'|'data'>): Transaction {
  return {
    get block () { return block },
    get blockHash () { return block.hash },
    get blockHeight () { return block.height },
    get chain () { return block.chain },
    get chainId () { return block.chainId },
    get hash () { return hash },
    get id () { return hash },
    get data () { return data },
  }
}

export function makeIdentity ({
  stub, name, address
}: Stubbable<Pick<Identity, 'name'|'address'>>) {
  return {
    name,
    address,
    ...stub ? {
      sign (doc: any) { return {} }
    } : {
      sign (doc: any) { throw Error.Unimplemented() }
    }
  }
}

export function makeAgent ({
  stub, chain, identity, fees
}: Stubbable<Pick<Agent, 'chain'|'identity'|'fees'>>): Agent {
  //if ((this.identity && (this.identity.name||this.identity.address))) {
    //const identityColor = randomColor({ // address takes priority in determining color
      //luminosity: 'dark', seed: this.identity.address||this.identity.name
    //})
    //this.log.label += ' '
    //this.log.label += colors.bgHex(identityColor).whiteBright(
      //` ${this.identity.name||this.identity.address} `
    //)
  //}
  //if ((this.identity && (this.identity.name||this.identity.address))) {
    //let myTag = `${this.identity.name||this.identity.address}`
    //const myColor = randomColor({ luminosity: 'dark', seed: myTag })
    //myTag = colors.bgHex(myColor).whiteBright.bold(myTag)
    //tag = [tag, myTag].filter(Boolean).join(':')
  //}
  return {
    fees,
    get chain () {
      return chain
    },
    get identity () {
      return identity
    },
    get address () {
      return identity.address
    },
    send (...args) {
      return send(this, ...args)
    },
    upload (...args) {
      return upload(this, ...args)
    },
    instantiate (...args) {
      return instantiate(this, ...args)
    },
    execute (...args) {
      return execute(this, ...args)
    },
    ...stub ? {
      fetchBalance (...args) {
        return {}
      },
      getConnection () {
        return {}
      },
      batch () {
        return {}
      },
    } : {
      fetchBalance (...args) {
        throw Error.Unimplemented()
      },
      getConnection () {
        throw Error.Unimplemented()
      },
      batch () {
        throw Error.Unimplemented()
      },
    }
  }
}

/** Extend the object returned by this function to implement transaction support. */
export function makeSigningConnection ({
  stub, chain, identity
}: Stubbable<Pick<SigningConnection, 'chain'|'identity'>>): SigningConnection {
  return {
    get chain () {
      return chain
    },
    get chainId () {
      return chain.id
    },
    get identity () {
      return identity
    },
    get address () {
      return identity.address
    },
    ...stub ? {
      sendImpl (...args) {
        return {}
      },
      uploadImpl (...args) {
        return {}
      },
      instantiateImpl (...args) {
        return {}
      },
      executeImpl (...args) {
        return {}
      },
    } : {
      sendImpl (...args) {
        throw Error.Unimplemented()
      },
      uploadImpl (...args) {
        throw Error.Unimplemented()
      },
      instantiateImpl (...args) {
        throw Error.Unimplemented() 
      },
      executeImpl (...args) {
        throw Error.Unimplemented()
      },
    },
  }
}

/** Extend the object returned by this function to implement batched transaction support. */
export function makeBatch ({
  stub, agent
}: Stubbable<Pick<Batch, 'agent'>>): Batch {
  return {
    get agent () { return agent },
    get chain () { return agent.chain },
    upload (...args: Parameters<Agent["upload"]>) {
      this.log.warn('upload: stub (not implemented)')
      return this
    },
    instantiate (...args: Parameters<Agent["instantiate"]>) {
      this.log.warn('instantiate: stub (not implemented)')
      return this
    },
    execute (...args: Parameters<Agent["execute"]>) {
      this.log.warn('execute: stub (not implemented)')
      return this
    },
    submit (...args: unknown[]): Promise<unknown> {
      this.log.warn('submit: stub (not implemented)')
      throw Error.Unimplemented()
    }
  }
}
