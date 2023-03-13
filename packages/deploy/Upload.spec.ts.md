# Fadroma Upload

## Upload CLI

```shell
$ fadroma upload CONTRACT   # nil if same contract is already uploaded
$ fadroma reupload CONTRACT # always reupload
```

## Upload API

```typescript
import { uploader } from '@fadroma/deploy'

await uploader({ /* options */ }).upload('contract')

await uploader({ /* options */ }).uploadMany(['contract', 'contract'])

await uploader({ /* options */ }).uploadMany({ c1: 'contract', c2: 'contract' })
```

## Uploader variants

### FSUploader

### FetchUploader

## Upload events

## Upload errors
