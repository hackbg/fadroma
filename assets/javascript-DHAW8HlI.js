import { conf as t, language as e, __tla as __tla_0 } from "./typescript-XxkOTivj.js";
import { __tla as __tla_1 } from "./index-GVCbR69S.js";
import "./index-DsRfobeB.js";
import "./cons-C8nhYyWL.js";
import { __tla as __tla_2 } from "./index-BTPAJTuf.js";
import "./index-CtQ99MjB.js";
let c, l;
let __tla = Promise.all([
  (() => {
    try {
      return __tla_0;
    } catch {
    }
  })(),
  (() => {
    try {
      return __tla_1;
    } catch {
    }
  })(),
  (() => {
    try {
      return __tla_2;
    } catch {
    }
  })()
]).then(async () => {
  c = t;
  l = {
    defaultToken: "invalid",
    tokenPostfix: ".js",
    keywords: [
      "break",
      "case",
      "catch",
      "class",
      "continue",
      "const",
      "constructor",
      "debugger",
      "default",
      "delete",
      "do",
      "else",
      "export",
      "extends",
      "false",
      "finally",
      "for",
      "from",
      "function",
      "get",
      "if",
      "import",
      "in",
      "instanceof",
      "let",
      "new",
      "null",
      "return",
      "set",
      "static",
      "super",
      "switch",
      "symbol",
      "this",
      "throw",
      "true",
      "try",
      "typeof",
      "undefined",
      "var",
      "void",
      "while",
      "with",
      "yield",
      "async",
      "await",
      "of"
    ],
    typeKeywords: [],
    operators: e.operators,
    symbols: e.symbols,
    escapes: e.escapes,
    digits: e.digits,
    octaldigits: e.octaldigits,
    binarydigits: e.binarydigits,
    hexdigits: e.hexdigits,
    regexpctl: e.regexpctl,
    regexpesc: e.regexpesc,
    tokenizer: e.tokenizer
  };
});
export {
  __tla,
  c as conf,
  l as language
};
