import { ContractWithSchema, loadSchemas } from "@hackbg/fadroma";

export const schema = loadSchemas(import.meta.url, {
  initMsg: "./schema/init.json",
  queryMsg: "./schema/q.json",
  handleMsg: "./schema/t_x.json",
  queryAnswer: "./schema/response.json",
});

export default class Votes extends ContractWithSchema {
  constructor(options = {}) {
    super(options, schema)
  }
}
