//export const conformNetworkToChainId = network => {
  //switch (network) {
    //case 'secret-2': case 'holodeck-2': case 'enigma-pub-testnet-3': return network
    //case 'mainnet': return 'secret-2'
    //case 'testnet': return 'holodeck-2'
    //case 'localnet': return 'enigma-pub-testnet-3'
    //default:
      //console.log(`🔴 ${network} is not a known chain id or category.`)
      //process.exit(1)
  //}
//}

//export const conformChainIdToNetwork = network => {
  //switch (network) {
    //case 'mainnet': case 'testnet': case 'localnet': return network
    //case 'secret-2': return 'mainnet'
    //case 'holodeck-2': return 'testnet'
    //case 'enigma-pub-testnet-3': return 'localnet'
    //default:
      //console.log(`🔴 ${network} is not a known chain id or category.`)
      //process.exit(1)
  //}
//}

//export async function pickInstance (network) {
  //network = conformNetworkToChainId(network)
  //const instanceDir = resolve(projectRoot, 'artifacts', network, 'instances')
  //if (!existsSync(instanceDir)) {
    //console.log(`🔴 ${instanceDir} does not exist - can't pick a contract to call.`)
    //process.exit(1)
  //}
  //const message = 'Select a contract to transfer:'
  //const {result} =
    //await prompts({ type: 'select', name: 'result', message, choices: readdirSync(instanceDir)
    //.filter(x=>x.endsWith('.json')).sort().reverse()
    //.map(instance=>{
      //const title = instance
      //const value = resolve(instanceDir, instance)
      //try {
        //const {contractAddress} = JSON.parse(readFileSync(value, 'utf8'))
        //return {title, value, description: contractAddress}
      //} catch (e) {
        //return {title, value: null, description: 'could not parse this instance file'}
      //}
    //}) })
  //if (typeof result === 'string') {
    //return result
  //} else {
    //console.log(`🔴 picked an invalid instance file - can't proceed`)
    //process.exit(1)
  //}
//}

//export async function pickNetwork () {
  //return await prompts(
    //{ type: 'select'
    //, name: 'network'
    //, message: 'Select network'
    //, initial: 0
    //, choices:
      //[ {title: 'localnet', value: 'localnet', description: 'local docker container'}
      //, {title: 'testnet',  value: 'testnet',  description: 'holodeck-2'}
      //, {title: 'mainnet',  value: 'mainnet',  description: 'secret network mainnet' } ] })
//}

//export async function pickKey () {
  //const keys = JSON.parse(outputOf('secretcli', 'keys', 'list'))
  //const keyToChoice = ({name, address})=>({title:name,value:{name,address},description:address})
  //const chosen = await prompts(
    //{ type: 'select'
    //, name: 'key'
    //, message: 'Select key from secretcli keyring'
    //, initial: 0
    //, choices: keys.map(keyToChoice) })
  //return chosen.key
//}
