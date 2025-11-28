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
