import { assert } from "chai";
import SchemaWrapper from "../scrt-agent/Wrapper.js";

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "QueryMsg",
  anyOf: [
    {
      type: "string",
      enum: ["pools", "total_rewards_supply"],
    },
    {
      type: "object",
      required: ["contract_status"],
      properties: {
        contract_status: {
          type: "object",
        },
      },
    },
    {
      type: "object",
      required: ["admin"],
      properties: {
        admin: {
          $ref: "#/definitions/AdminQueryMsg",
        },
      },
    },
    {
      type: "object",
      required: ["transaction_history"],
      properties: {
        transaction_history: {
          type: "object",
          required: ["address", "key", "page_size"],
          properties: {
            address: {
              $ref: "#/definitions/HumanAddr",
            },
            key: {
              type: "string",
            },
            page: {
              type: ["integer", "null"],
              format: "uint32",
              minimum: 0.0,
            },
            page_size: {
              type: "integer",
              format: "uint32",
              minimum: 0.0,
            },
          },
        },
      },
    },
  ],
  definitions: {
    AdminQueryMsg: {
      type: "string",
      enum: ["admin"],
    },
    HumanAddr: {
      type: "string",
    },
  },
};

// This is a mock instance of a SecretNetworkContract
const instance = {
  query: (method, args) => {
    return { method, args };
  },
  execute: (method, args) => {
    return { method, args };
  },
  copy: (agent) => {
    return agent;
  }
};

// This is a mock instance of some random contract
const instance2 = {
  query: (method, args) => {
    return { method, args, identity: "second" };
  },
  execute: (method, args) => {
    return { method, args, identity: "second" };
  },
};

const wrapper = SchemaWrapper(schema, instance);

describe("Schema wrapper", function () {
  it("Has all the methods", function () {
    const methods = Object.keys(wrapper).join(",");

    assert.strictEqual(methods, "pools,total_rewards_supply,totalRewardsSupply,contract_status,contractStatus,admin,transaction_history,transactionHistory");
  });

  it("Works on string items", function () {
    const res = wrapper.pools();
    assert.strictEqual(res.method, "pools");
    assert.strictEqual(res.args, null);

    const res2 = wrapper.total_rewards_supply();
    assert.strictEqual(res2.method, "total_rewards_supply");
    assert.strictEqual(res2.args, null);
  });

  it("Works when using camelCase instead of snake_case", function () {
    const res = wrapper.totalRewardsSupply();
    assert.strictEqual(res.method, "total_rewards_supply");
    assert.strictEqual(res.args, null);
  });

  it("Works when calling object but that has no arguments to pass", function () {
    const res = wrapper.contract_status();
    assert.strictEqual(res.method, "contract_status");
    assert.strictEqual(JSON.stringify(res.args), "{}");
  });

  it("Works when calling nested argumented object", function () {
    const res = wrapper.admin('admin');
    assert.strictEqual(res.method, "admin");
    assert.strictEqual(res.args, "admin");
  });

  it("Works when calling object with correct arguments", function () {
    const args = {
      address: "test",
      key: "test",
      page: 1,
      page_size: 11,
    };

    const res = wrapper.transaction_history(args);
    assert.strictEqual(res.method, "transaction_history");
    assert.strictEqual(JSON.stringify(res.args), JSON.stringify(args));
  });

  it("Fails schema validation", function () {
    try {
      wrapper.transaction_history();

      // Shouldn't get here...
      assert.strictEqual(false, true);
    } catch (e) {
      assert.strictEqual(
        e.message.split("\n")[0],
        "Arguments validation returned error:"
      );
    }
  });

  it("Accepts using different agent", function () {
    const res = wrapper.pools(instance2);
    assert.strictEqual(res.method, "pools");
    assert.strictEqual(res.args, null);
    assert.strictEqual(res.identity, "second");

    const args = {
      address: "test",
      key: "test",
      page: 1,
      page_size: 11,
    };

    const res2 = wrapper.transaction_history(args, instance2);
    assert.strictEqual(res2.method, "transaction_history");
    assert.strictEqual(JSON.stringify(res2.args), JSON.stringify(args));
    assert.strictEqual(res2.identity, "second");
  });
});
