import { ConnectConsole, ConnectError } from '@fadroma/connect'

export class UploadConsole extends ConnectConsole {
  label = 'Fadroma.Uploader'
}

export class UploadError extends ConnectError {}
