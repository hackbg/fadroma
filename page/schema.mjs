export default class CosmWasmSchema {
  constructor (source, {
    contract_name, contract_version, idl_version, description,
    instantiate, execute, query, migrate, sudo, responses
  }) {
    this.source = source
    Object.assign(this, {
      contract_name, contract_version, idl_version, description,
      instantiate, execute, query, migrate, sudo, responses
    })
  }

  getOverview () {
    const props = new Map()
    props.set('Source',
      this.source || `❌`)
    props.set('Name',
      this.contract_name || `❌`)
    props.set('Version',
      this.contract_version || `❌`)
    props.set('IDL version',
      this.idl_version || `❌`)
    props.set('Description',
      this.description || `❌`)
    props.set('Instantiate',         this.instantiate?.properties
      ? `${Object.keys(this.instantiate.properties).length} parameter(s)` : `❌`)
    props.set('Transaction methods', this.execute?.oneOf?.length
      ? `${this.execute.oneOf.length} method(s)`   : `❌`)
    props.set('Query methods',       this.query?.oneOf?.length
      ? `${this.query?.oneOf?.length} method(s)`   : `❌`)
    props.set('Migrate methods',     this.migrate?.oneOf?.length
      ? `${this.migrate?.oneOf?.length} method(s)` : `❌`)
    props.set('Sudo methods',        this.sudo?.oneOf?.length
      ? `${this.sudo?.oneOf?.length} method(s)`    : `❌`)
    props.set('Responses',           this.responses
      ? `${Object.keys(this.responses).length}`    : `❌`)
    return props
  }

  toMd () {
  }

  toHtml () {
  }

  toJsonCompact () {
  }

  toJsonPretty () {
  }

  toYaml () {
  }

}
