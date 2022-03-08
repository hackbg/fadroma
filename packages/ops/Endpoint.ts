import { get } from 'http'

/** Management endpoints for managed devnet and build containers. */
export class Endpoint {

  url: URL

  constructor (url: string) {
    this.url = new URL(url)
  }

  get (pathname: string = '', params: Record<string, string> = {}): Promise<any> {
    const url = Object.assign(new URL(this.url.toString()), { pathname })
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    return new Promise((resolve, reject)=>{
      get(url.toString(), res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(JSON.parse(data)))
      }).on('error', reject)
    })
  }

}
