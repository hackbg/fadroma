import type * as Namada from './namadaTypes.ts'

export async function fetchProtocolParameters (
  connection: Pick<Namada.ConnectionBase, 'fetchStorageValueImpl'|'decode'>
) {
  const keys = connection.decode.storage_keys();
  const parameters: Record<string, unknown> = {}
  await Promise.all(Object.entries(connection.decode.storage_keys())
    .map(([name, key])=>connection.fetchStorageValueImpl(key).then(binary=>{
      //console.log({name, key, binary})
      if (binary.length === 0) {
        return
      }
      switch (name) {
        case 'gasCostTable':
          return parameters[name]=connection.decode.gas_cost_table(binary)
        case 'epochDuration':
          return parameters[name]=connection.decode.epoch_duration(binary)
        case 'maxTxBytes':
          return parameters[name]=connection.decode.u32(binary)
        case 'txAllowlist':
        case 'vpAllowlist':
          return parameters[name]=connection.decode.vec_string(binary)
        case 'isNativeTokenTransferable':
          return parameters[name]=!!binary[0]
        case 'implicitVpCodeHash':
          return parameters[name]=connection.decode.code_hash(binary)
        default:
          return parameters[name]=connection.decode.u64(binary)
      }
    })))
  return parameters
}
