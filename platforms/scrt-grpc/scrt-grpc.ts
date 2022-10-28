/*
  Fadroma Platform Package for Secret Network with gRPC/Protobuf API
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import * as SecretJS from 'secretjs'
import type { AgentClass, BundleClass } from '@fadroma/client'
import { ScrtGrpc }       from './scrt-grpc-chain'
import { ScrtGrpcAgent }  from './scrt-grpc-agent'
import { ScrtGrpcBundle } from './scrt-grpc-bundle'

ScrtGrpc.SecretJS     = SecretJS
ScrtGrpc.Agent        = ScrtGrpcAgent  as unknown as AgentClass<ScrtGrpcAgent>
ScrtGrpc.Agent.Bundle = ScrtGrpcBundle as unknown as BundleClass<ScrtGrpcBundle>
Object.defineProperty(ScrtGrpcAgent,  'SecretJS', { enumerable: false, writable: true })
Object.defineProperty(ScrtGrpcBundle, 'SecretJS', { enumerable: false, writable: true })

export { SecretJS }
export * from './scrt-grpc-config'
export * from './scrt-grpc-chain'
export * from './scrt-grpc-agent'
export * from './scrt-grpc-bundle'
