import { SecretNetworkContractWithSchema } from "@fadroma/scrt-agent";
import { loadSchemas } from "@fadroma/utilities";

export const schema = loadSchemas(import.meta.url, {
  initMsg: "./schema/init.json",
  queryMsg: "./schema/q.json",
  handleMsg: "./schema/t_x.json",
  queryAnswer: "./schema/response.json",
});

export default class Votes extends SecretNetworkContractWithSchema {
  constructor(options = {}) {
    super(options, schema);
  }
}