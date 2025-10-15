import { Keypair, connection, payer, accountRent } from './client.ts';
import { web3 } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  ACCOUNT_SIZE,
  ExtensionType, getMintLen,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToInstruction,
  createApproveInstruction,
} from '@solana/spl-token';

export const System = web3.SystemProgram;

export const Budget = web3.ComputeBudgetProgram;

export const Loader = {
  programId: new web3.PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
};

export const Token = {
  programId: TOKEN_PROGRAM_ID,
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
  ]
  getAta: ({
    tokenProgram = programId, mint, owner, offCurve = false
  }) => getAssociatedTokenAddressSync(
    mint, owner, offCurve, tokenProgram
  )
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
  }
  getOrCreateAta: async ({
    tokenProgram = programId, mint, owner, offCurve = false
  }) => {
    const ata = getAta({ tokenProgram, mint, owner, offCurve })
    if (!await connection.getAccountInfo(ata)) {
      if (offCurve) throw new Error("only program can create off-curve ATA")
      return await createAta({ tokenProgram, mint, owner })
    }
    return ata
  }
  mintApi: (mint, programId = TOKEN_PROGRAM_ID) {
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
};

export const Token2022 = {
  programId: TOKEN_2022_PROGRAM_ID,
  createMint: ({
    tokenProgram = programId, ...args
  }: Parameters<typeof Token.createMint>[0]) =>
    Token.createMint({ tokenProgram, ...args }),
  getAta: ({ tokenProgram = programId, mint, owner, offCurve = false }) =>
    Token.getAta({ tokenProgram, mint, owner, offCurve }),
  createAta: ({ tokenProgram = programId, mint, owner }) =>
    Token.createAta({ tokenProgram, mint, owner }),
  getOrCreateAta: ({ tokenProgram = programId, mint, owner, offCurve = false }) =>
    Token.getOrCreateAta({ tokenProgram, mint, owner, offCurve })
  mintApi: (mint, programId = TOKEN_2022_PROGRAM_ID) =>
    Token.mintApi(mint, programId),
};
