import { env } from './deps.ts';
env.ANCHOR_PROVIDER_URL ??= 'http://localhost:8899';
env.ANCHOR_WALLET ??= resolve(homedir(), '.config/solana/id.json'); // FIXME use XDG
import {
  ok, equal, expect, forbid, call, renamed,
  Case, resolve, homedir, pick, when, dir, toml, gitignore, readme,
  ts, packageJson, tsConfig, eslintConfig,
  rs, cargoToml, baconConfig, moldConfig,
  Anchor, Program, workspace,
  ACCOUNT_SIZE, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ExtensionType, getMintLen,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToInstruction,
  createApproveInstruction,
  getMinimumBalanceForRentExemptAccount,
} from './deps.ts';
import type {
  Name, Named, Semver, CargoDep, CargoFeature, MaybeAsync, IDL, NotIDL
} from './deps.ts';

export type ProjectOptions = Named & {
  name:      Name,
  legacy:    boolean,
  anchor:    boolean|Semver,
  solana:    boolean|Semver,
  node:      boolean|Semver,
  deno:      boolean|Semver,
  ts:        boolean|Semver,
  pnpm:      boolean,
  bacon:     boolean,
  eslint:    boolean,
  web3:      boolean|Semver,
  kit:       boolean|Semver,
  codama:    boolean|Semver,
  mold:      boolean,
  idl:       IDL|null,
  notIdl:    NotIDL|null,
  dotenv:    boolean,
  direnv:    boolean,
  programs?: ProgramOptions[],
};

export type ProgramOptions = Named & {
  name:      Name,
  idl:       IDL|null,
  notIdl:    IDL|null,
  solana:    Semver,
  anchor:    Semver|null,
  deps?:     CargoDep[],
  devDeps?:  CargoDep[],
  features?: CargoFeature[]
};

export const initProject = (opts: ProjectOptions) => (path: string) => dir(path,
  gitignore(),
  readme({ name }),
  when(opts.node,   packageJson({ name, legacy: opts.legacy })),
  when(opts.ts,     tsConfig),
  when(opts.bacon,  baconConfig),
  when(opts.eslint, eslintConfig),
  when(opts.mold,   moldConfig),
  dir('test', ts("test.ts"), dir("accounts")),
  toml('Cargo.toml', {
    "workspace": {
      resolver: "2", members: [ "programs/*" ]
    },
    "profile.release": {
      "codegen-units": 1, "overflow-checks": true, "lto": "fat",
    },
    "profile.release.build-override": {
      "codegen-units": 1, "incremental": "false", "opt-level": 3,
    }
  }),
  when(opts.anchor,
    toml('Anchor.toml', {
      "toolchain": {
        "solana_version": opts.solana, "package_manager": opts.pnpm ? "pnpm" : "npm",
      },
      "features": { "resolution": true, "skip-lint": false, },
      "programs.localnet": { [name]: "", },
      "registry": { "url": "https://api.apr.dev" },
      "provider": { "cluster": "localnet", "wallet": "~/.config/solana/id.json" },
      "scripts": { "test": "./test/test.ts" },
      "test": {
        "startup_wait":  5000,
        "shutdown_wait": 2000,
        "upgradeable":   true
      },
      "test.validator": {
        "bind_address": "127.0.0.1",
        "url": "https://api.devnet.solana.com",
        "ledger": ".anchor/test-ledger",
        "rpc_port": "8899"
      }
    }),
    dir('programs', initProgram({ name, idl: opts.idl, notIdl: opts.notIdl }))));

export const initProgram = (path: string, opts: ProgramOptions) => dir(path,
  cargoToml(pick('name', 'deps', 'devDeps', 'features')(opts)),
  dir('src', rs('lib.rs')));

export { Anchor, Program, workspace }
export const wallet = Anchor.AnchorProvider.env().wallet
export const { payer, publicKey } = wallet;
export const commitment  = 'processed'
export const connection  = new Anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL, commitment);
export const accountRent = await getMinimumBalanceForRentExemptAccount(connection);
export const provider    = new Anchor.AnchorProvider(connection, wallet);
Anchor.setProvider(provider);
export const get = (pubkey) => connection.getAccountInfo(pubkey)
export const pda = (program, seeds) => PK.findProgramAddressSync(seeds.map(toSeed), program)[0]
export const toSeed = seed => {
  if (seed instanceof PK) seed = seed.toBuffer()
  if (seed instanceof BN || typeof seed === 'bigint' || typeof seed === 'number') seed = numToBuf(seed)
  return seed
}
export const numToBuf = (n: string|number|bigint|InstanceType<typeof BN>) => {
  if (!(typeof n === 'bigint')) n = BigInt(String(n))
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(n, 0);
  return bytes;
}
export const {
  Transaction,
  Keypair
} = Anchor.web3
export const getBalances = (keys: PK[]) =>
  Promise.all(keys.map(key=>connection.getBalance(key)))
export const sendTx = async (signers: KP[], tx: unknown) =>
  provider.sendAndConfirm(await showTx(await tx), signers);
export const sendIx = async (signers: KP[], ix: unknown) =>
  sendTx(signers, new Transaction().add(await lazy(ix)))
export const sendIxs = (signers, ...ixs) =>
  sendTx(signers, buildTx(...ixs));
export const lazy = async ix => {
  ix = await ix
  if (typeof ix === 'function') ix = ix()
  return await ix
}
export const buildTx = async (...ixs) => {
  const info = []
  const tx = new Transaction();
  for (let ix of ixs) {
    if (ix) {
      ix = await lazy(ix)
      if (typeof ix === 'string') {
        info.push(ix)
      } else if (typeof ix !== 'boolean') {
        tx.add(ix)
      }
    }
  }
  Object.assign(tx, { description: info.join('; ') })
  return tx
}
export const buildIx = async (
  program: Program, [methodName, ...args]: [string, ...unknown[]],
  accounts: Record<Name, MaybeAsync<PK>>, ...remainingAccounts: unknown[]
) => {
  let info = `⬅️` // Log in one burst at end to avoid interspersal with localnet logs
  const method = program.methods[methodName]
  if (!method) throw new Error(`not a method: ${methodName}`)
  const ixIdl = findInIdl(program, methodName);
  info += ['', blue(pad2(String(program.programId))), 'ix', blue(methodName)].join(' ')
  accounts = Object.entries(accounts).sort(axByName)
  accounts = accounts.map(([account, pk])=>prepareAccount(ixIdl, account, pk))
  accounts = Object.fromEntries(await Promise.all(accounts))
  accounts['systemProgram'] ??= PK.default
  const ix = await method(...ixIdl.args.map((argInfo, index)=>{
    const [arg, msg] = prepareArg(ixIdl.name, argInfo, args[index], index)
    info += msg
    return arg
  }))
    .accounts(accounts)
    .remainingAccounts(remainingAccounts)
    .instruction()
  console.debug(info)
  return ix
}

const sendTxVerbosity    = 1
const showAccountBalance = 0
const showAccountSize    = 0
const showAccountData    = 0
export const showTx = async (tx) => {
  tx = await Promise.resolve(tx)
  let info = `⬅️ Send ${tx.instructions.length} ix`
  if (tx.description) info += `: ${tx.description}.`
  for (const ixIndex in tx.instructions) {
    const ix = tx.instructions[ixIndex];
    if (sendTxVerbosity > 1) info += `\n⬅️ IX#${String(ixIndex).padEnd(3)}to ${ix.programId.toString()} (${ix.data.length}b)`;
    const balances = await getBalances(ix.keys.map(ax=>ax.pubkey).filter(Boolean));
    for (const axIndex in ix.keys) {
      const ax  = ix.keys[axIndex];
      let key = ax.pubkey?.toString().padEnd(44)
      if (!key) key = red(`MISSING`.padEnd(44))
      const sig = ax.isSigner   ? 'sig' : '___';
      const mut = ax.isWritable ? 'mut' : '___';
      const bal = String(balances[axIndex]).padStart(18);
      if (sendTxVerbosity > 1) info += `\n   ax#${(String(axIndex)+':').padEnd(5)} ${key}  ${sig}  ${mut}  ${bal}`;
    }
    if (sendTxVerbosity > 1) if (ix.reflected) info += `\n🔍️ Reflected: ${stringify(ix.reflected)}`
  }
  if (sendTxVerbosity > 0) console.debug(info)
  return tx
}
const buildTxVerbosity = 2
const axByName = (a, b) => (a[0] > b[0]) ? 1 : (a[0] < b[0]) ? -1 : 0
const maxLength = 30//prepared.reduce((max, [name, _])=>Math.max(max, name.length), 28)
function findInIdl (program, name: string) {
  const rawName = Case.snake(name)
  return (program as any)._rawIdl.instructions.find(ix=>ix.name===rawName)
}
async function prepareAccount (ixIdl, account, pk) {
  let msg = ''
  const name = Case.snake(account)
  if (!ixIdl.accounts.some(ax=>ax.name===name)) {
    const names = ixIdl.accounts.map(ax=>Case.camel(ax.name)).join(', ')
    throw new Error(`unexpected account: ${account}. allowed: ${names}`)
  }
  if (!(pk instanceof PK)) {
    pk = (typeof pk === 'object') ? stringify(pk) : pk
    throw new Error(`not a pubkey: ${account} = ${pk}`)
  }
  if (buildTxVerbosity > 2) {
    let extra = '·'
    if (buildTxVerbosity > 3) {
      const [balance, accountInfo] = await Promise.all([
        connection.getBalance(pk), connection.getAccountInfo(pk)
      ])
      extra += ' ' + yellow((balance ? String(balance) : '---').padStart(18))
      extra += '  '
      if (accountInfo) {
        const { space = '' } = accountInfo as any
        extra += blue((String(space)+'b').padStart(8))
      } else {
        extra += '        '
      }
      if (accountInfo) {
        extra += `  `
        accountInfo.data.slice(0, 8).forEach((byte, _index)=>{
          extra += `${toHex(byte, 2)} `
        })
      }
    }
    const pkView = preparePk(pk)
    msg += '\n   ' + [pkView, account.padEnd(maxLength), extra].join(' ')
  }
  return [account, pk, msg]
}
function preparePk (pk) {
  let pkView = (pk?.toString()||'')
  if (pkView === '11111111111111111111111111111111') pkView = purple(pkView.padEnd(51))
  if (pkView === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') pkView = purple(pkView.padEnd(51))
  if (pkView === payer.publicKey.toString()) pkView = yellow(pkView.padEnd(51))
  pkView = pkView.padEnd(51)
  return pkView
}
function prepareArg (ixName, arg, value, index) {
  try {
    let msg = ''
    if (!arg)
      throw new Error(`unexpected arg #${index} for ${ixName}`)
    let argType = arg.type ||
      (value instanceof BN ? 'u64' : typeof value)
    if (argType?.defined?.name)
      argType = argType.defined.name
    if (typeof argType === 'object')
      argType = stringify(argType)
    if (argType === 'bytes' && value?.length)
      argType += ` (${value.length})`
    if (buildTxVerbosity > 1)
      msg += `\n   · arg #${index}: ${argType}`.padEnd(55)
        + ` ` + Case.camel(arg.name) + '\n     ' + prepareArgVal(value)
    return [value, msg]
  } catch (e) {
    throw Object.assign(e, { ixName, value, index, ...arg })
  }
}
function prepareArgVal (arg) {
  const result =
    (arg === null)            ? red('null')      :
    (arg === undefined)       ? red('undefined') :
    (arg instanceof BN)       ? String(arg)      :
    (arg instanceof PK)       ? arg.toString()   :
    (arg instanceof Buffer)   ? showBuffer(arg) :
    (typeof arg === 'object') ? showObject(arg)  :
      JSON.stringify(arg)
  return result
}
function showBuffer (buffer) {
  return fields([...buffer]
    .map(x=>toHex(x))
    .reduce(grouped, [])
    .map(group=>group.join(' ')))
}
function showObject (object) {
  return fields(Object.entries(object)
    .map(([x,y])=>`· ${x.padEnd(20)} \n     ${
      (y instanceof Buffer) ? showBuffer(y) :
      JSON.stringify(y)}`))
}
function fields (fields) {
  return fields.join('\n     ')
}
function grouped (groups = [], item, index) {
  const group = Math.floor(index / 16)
  groups[group] ??= []
  groups[group].push(item)
  return groups
}
const toProgram = <T extends {}>(id: string, api?: (_: PK)=>T) =>
  Object.assign(api ? api(new PK(id)) : {}, { programId: new PK(id) });

export const System    = Anchor.web3.SystemProgram;
export const Budget    = Anchor.web3.ComputeBudgetProgram;
export const Loader    = toProgram('BPFLoaderUpgradeab1e11111111111111111111111');
export const Token     = toProgram(TOKEN_PROGRAM_ID,      tokenProgramApi);
export const Token2022 = toProgram(TOKEN_2022_PROGRAM_ID, tokenProgramApi);
function tokenProgramApi (programId: PK): {
  createMint     (): unknown[],
  getAta         (): unknown,
  createAta      (): unknown,
  getOrCreateAta (): unknown,
  mintApi (mint: PK, programId?: PK): {
    approve (
      owner: PK, account: PK, authority: PK, amount: number, bumps?: unknown[]): unknown,
    getAta (
      owner: PK, offCurve?: boolean): unknown,
    initAccount (
      account: PK, owner?: PK): unknown,
    initAccountSpace (
      account: PK, from?: PK): unknown,
    initMint (
      decimals: number, authority?: PK, freezer?: PK): unknown,
    initMintSpace (
      lamports: number, space: number, from?: PK): unknown,
    initScaledUiAmountConfig (
      multiplier: number, authority?: payer.publicKey): unknown,
    mintTo (
      owner: PK, amount: number, authority?: PK, bumps?: unknown[]): unknown,
  },
} {
  return {
    createMint: ({
      tokenProgram = programId,
      mintKeypair  = new Keypair(),
      mint         = mintKeypair.publicKey,
      decimals     = 9,
      extensions   = [ExtensionType.ScaledUiAmountConfig],
      mintSpace    = getMintLen(extensions),
      mintIxs      = mintApi(mint, tokenProgram),
      multiplier   = 1.0,
    }) => [
      `init space for token mint at ${mint.toString()}`,
      connection.getMinimumBalanceForRentExemption(mintSpace).then(fee=>mintIxs.initMintSpace(fee, mintSpace)),
      'init ScaledUiAmountConfig extension immediately after account creation',
      mintIxs.initScaledUiAmountConfig(multiplier),
      'init mint',
      mintIxs.initMint(decimals),
    ],
    getAta: ({
      tokenProgram = programId, mint, owner, offCurve = false
    }) => getAssociatedTokenAddressSync(
      mint, owner, offCurve, tokenProgram
    ),
    createAta: async ({
      tokenProgram = programId, checkMint = true, mint, owner
    }) => {
      if (checkMint && !await connection.getBalance(mint)) {
        throw new Error(`ata: mint does not exist: ${mint}`)
      }
      return await createAssociatedTokenAccountInstruction(
        payer.publicKey, getAta({ tokenProgram, mint, owner }),
        owner, mint, tokenProgram
      )
    },
    getOrCreateAta: async ({
      tokenProgram = programId, mint, owner, offCurve = false
    }) => {
      const ata = getAta({ tokenProgram, mint, owner, offCurve })
      if (!await connection.getAccountInfo(ata)) {
        if (offCurve) throw new Error("only program can create off-curve ATA")
        return await createAta({ tokenProgram, mint, owner })
      }
      return ata
    },
    mintApi: (mint: PK, programId = TOKEN_PROGRAM_ID) => {
      if (mint?.publicKey) mint = mint.publicKey
      const reflect = (ix, reflected) => Object.assign(ix, { reflected })
      return {
        getAta (owner, offCurve?) {
          return getAta({ tokenProgram: programId, mint, owner, offCurve })
        },
        initScaledUiAmountConfig (multiplier, authority = payer.publicKey) {
          return reflect(createInitializeScaledUiAmountConfigInstruction(
            mint, authority, multiplier, programId
          ), { createInitializeScaledUiAmountConfigInstruction: {
            mint, authority, multiplier, programId
          } })
        },
        initMint (decimals, authority = payer.publicKey, freezer = null) {
          return reflect(createInitializeMintInstruction(
            mint, decimals, authority, freezer, programId
          ), { createInitializeMintInstruction: {
            mint, decimals, authority, freezer, programId
          } })
        },
        initAccount (account, owner = payer.publicKey) {
          account = (account?.publicKey) ?? account
          return reflect(createInitializeAccountInstruction(
            account, mint, owner, programId
          ), { createInitializeAccountInstruction: {
            account, mint, owner, programId
          } })
        },
        mintTo (account, amount, authority = payer.publicKey, bumps = []) {
          account = (account?.publicKey) ?? account
          return reflect(createMintToInstruction(
            mint, account, authority, amount, bumps, programId
          ), { createMintToInstruction: {
            mint, account, authority, amount, bumps, programId
          } })
        },
        approve (owner, account, authority, amount, bumps = []) {
          return reflect(createApproveInstruction(
            account, authority, owner, amount, bumps, programId
          ), { createApproveInstruction: {
            account, authority, owner, amount, bumps, programId
          } })
        },
        initMintSpace (lamports, space, fromPubkey = payer.publicKey) {
          return System.Program.createAccount({
            programId, fromPubkey, lamports, space,
            newAccountPubkey: mint,
          })
        },
        initAccountSpace (newAccountPubkey, fromPubkey = payer.publicKey) {
          newAccountPubkey = (newAccountPubkey?.publicKey) ?? newAccountPubkey
          return System.Program.createAccount({
            programId, fromPubkey, newAccountPubkey,
            lamports: accountRent, space: ACCOUNT_SIZE,
          })
        },
      }
    }
  }
}

export const testAx = (name, address, ...validators) =>
  expect(name, call(exists, address, name), ...validators)
export const testTx = (name, signers, ...args) =>
  expect(name, call(sendIxs, signers, ...args))
export const forbidTx = (signers, name, ...args) =>
  forbid(name, call(sendIxs, signers, ...args))
export const logMustContain = (text) =>
  renamed(`must log ${text}`, function logMustContainRun (tx) {
    return tx
    //const { transactionLogs: logs = [] } = e
    //try {
      //ok(logs.filter(includes(text)).length > 0, `error logs MUST contain ${text}`)
    //} catch (e) {
      //console.error({logs})
      //throw e
    //}
  })
export const errorLogMustContain = (text) => renamed(`must error with ${text}`,
  function errorLogMustContainRun (e) {
    const { transactionLogs: logs = [] } = e
    if (logs.filter(includes(text)).length > 0, `error logs MUST contain ${text}`) {
      return e
    }
    throw e
  })
export async function assertBalance (address, value, name) {
  const balance = await connection.getBalance(address);
  equal(balance, value, `${name} MUST have ${value} lamports`);
  return balance;
}
export async function exists (address, name) {
  try {
    const data = await get(address);
    ok(!!data, `${name} at ${address} MUST exist`);
    return data
  } catch (e) {
    throw formatError(e, name)
  }
}
