import { Path } from '@hackbg/file'
import { packageRoot } from './package'

export function alpineDevnet ({
  platformName, platformVersion, baseImage, baseSha256
}: {
  platformName:    string,
  platformVersion: string,
  baseImage:       string,
  baseSha256:      string,
}) {
  return {
    name:        `ghcr.io/hackbg/fadroma-devnet:${platformName}-${platformVersion}`,
    dockerfile:  new Path(packageRoot, 'dockerfiles', `devnet-alpine.Dockerfile`).absolute,
    buildArgs:   { BASE: `${baseImage}@sha256:${baseSha256}` },
    inputFiles:  [`devnet.init.mjs`]
  }
}

export function debianDevnet ({
  platformName, platformVersion, baseImage, baseSha256
}: {
  platformName:    string,
  platformVersion: string,
  baseImage:       string,
  baseSha256:      string,
}) {
  return {
    name:        `ghcr.io/hackbg/fadroma-devnet:${platformName}-${platformVersion}`,
    dockerfile:  new Path(packageRoot, 'dockerfiles', `devnet-debian.Dockerfile`).absolute,
    buildArgs:   { BASE: `${baseImage}@sha256:${baseSha256}` },
    inputFiles:  [`devnet.init.mjs`]
  }
}

export function ubuntuDevnet ({
  platformName, platformVersion, baseImage, baseSha256
}: {
  platformName:    string,
  platformVersion: string,
  baseImage:       string,
  baseSha256:      string,
}) {
  return {
    name:        `ghcr.io/hackbg/fadroma-devnet:${platformName}-${platformVersion}`,
    dockerfile:  new Path(packageRoot, 'dockerfiles', `devnet-ubuntu.Dockerfile`).absolute,
    buildArgs:   { BASE: `${baseImage}@sha256:${baseSha256}` },
    inputFiles:  [`devnet.init.mjs`]
  }
}
