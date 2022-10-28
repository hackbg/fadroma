export function mergeAttrs (attrs: {key:string, value:string}[]) {
  return attrs.reduce((obj,{key,value})=>Object.assign(obj,{[key]:value}),{})
}

