type Connection = { abciQuery: (path: string) => Promise<Uint8Array> };
import * as BorshJS from "borsh";

export async function getCurrentEpoch(connection: Connection) {
  const epoch = await connection.abciQuery("/shell/epoch");
  return BorshJS.deserialize(
      {
          struct: {
              epoch: "u64",
          },
      },
      epoch
  );
}
