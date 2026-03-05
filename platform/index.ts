/**
  Fadroma Platform Modules
  Copyright (C) 2023-2025 Hack.bg

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

// Bitcoin, Elements
export { default as Bitcoin } from './Bitcoin/Bitcoin.ts';

// SimplicityHL
export * as SimplicityHL from './SimplicityHL/src/sdk.ts';

// TODO: Reenable other platforms:
//
// 1. export { default as Solana, SolanaWeb3 } from './Solana/Solana.ts';
//
// 2. export { default as Tendermint }         from './Tendermint/Tendermint.ts';
//    export { default as Namada }             from './Namada/Namada.ts';
//
// 3. export { default as CosmWasm }           from './CosmWasm/CosmWasm.ts';
//    export { default as SecretNetwork }      from './SecretNetwork/SecretNetwork.ts';
//
