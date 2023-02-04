import { ConnectConsole, ConnectError } from '@fadroma/connect'

export class UploadConsole extends ConnectConsole {
  label = '@fadroma/deploy'
}

export class UploadError extends ConnectError {}
