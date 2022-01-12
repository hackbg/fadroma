export * from './cli'
export * from './network'
export * from './system'

export function pick (obj: Record<any, any>, ...keys: Array<any>) {
  return Object.keys(obj)
    .filter(key=>keys.indexOf(key)>-1)
    .reduce((obj2,key)=>{
      obj2[key] = obj[key]
      return obj2 }, {})
}

export function required (label: string) {
  return () => { throw new Error(`required: ${label}`) }
}
