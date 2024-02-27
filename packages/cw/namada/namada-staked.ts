import * as BorshJS from "borsh";

type Connection = { abciQuery: (path: string) => Promise<Uint8Array> };

export async function getTotalStake(connection: Connection) {
  const totalStake = await connection.abciQuery("/vp/pos/total_stake");
    return BorshJS.deserialize(
    {
      struct: {
        totalStake: "u64",
      }
    }, totalStake);
}
