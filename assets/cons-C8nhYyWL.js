globalThis.DocumentFragment ?? (globalThis.DocumentFragment = class {
});
function E(e, s) {
  for (const [c, a] of Object.entries(s)) {
    const p = Object.assign(document.createAttribute(c), { value: a });
    e.attributes.setNamedItem(p);
  }
  return e;
}
const N = /^[\w-]+/, A = /^#[\.?\w-:/]+/, j = /^\.[\w-:/]+/, I = /\[([^\[]+?)(=[^\[]+?)?\]/;
function T(e) {
  const [s] = e.match(N);
  e = e.slice(s.length);
  let c = null;
  const a = [], p = {};
  for (; e.length > 0; ) {
    let n;
    if (n = e.match(A), n) {
      if (c !== null) throw new Error(`DOM: duplicate id: ${n[0]}`);
      c = n[0].slice(1), e = e.slice(n[0].length);
      continue;
    }
    if (n = e.match(j), n) {
      a.push(n[0].slice(1)), e = e.slice(n[0].length);
      continue;
    }
    if (n = e.match(I), n) {
      const [l, f] = n[0].slice(1, -1).split("=");
      p[l] = f, e = e.slice(n[0].length);
      continue;
    }
    throw new Error(`DOM: invalid: ${e}`);
  }
  return { tag: s, id: c, classes: a, attrs: p };
}
globalThis.document ?? (globalThis.document = { createElementNS: () => ({}) });
const _ = S;
function S(...e) {
  if (e[0] && !e[0][Symbol.iterator]) return S(e);
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const c of e) S.Add(s, c);
  return s;
}
((e) => {
  e.Add = function(c, a) {
    if (!a) return;
    if (!a[Symbol.iterator]) throw new Error(`SVG: non-tuple: ${a}`);
    const [p, ...n] = a;
    if (typeof a[0] != "string") throw new Error(`SVG: non-string: ${a[0]}`);
    const { tag: l, id: f, attrs: w = {}, classes: o = [] } = T(p), r = E(document.createElementNS("http://www.w3.org/2000/svg", l), w);
    f && (r.id = f);
    for (const t of o) r.classList.add(t);
    for (const t of n) {
      if (!t) return;
      if (typeof t == "string") r.append(document.createTextNode(t));
      else if (typeof t == "object") if (t[Symbol.iterator]) e(t).childNodes.forEach((u) => r.append(u));
      else for (const [u, C] of Object.entries(t)) r[u] = C;
      else if (t) throw new Error(`SVG: invalid prop: ${t}`);
    }
    c.appendChild(r);
  };
})(S || (S = {}));
function m(...e) {
  if (e[0] && !e[0][Symbol.iterator]) return m(e);
  const s = new DocumentFragment();
  for (const c of e) m.add(s, c);
  return s;
}
((e) => {
  function s(o) {
    return document.getElementById(o);
  }
  e.id = s;
  function c(o) {
    return o.innerHTML = "", o;
  }
  e.clear = c;
  function a(o, r, t) {
    return o == null ? void 0 : o.addEventListener(r, t), t;
  }
  e.on = a;
  function p(o) {
    return e([`div${o}`]).firstChild;
  }
  e.Div = p;
  function n(o, ...r) {
    for (const t of r) o.appendChild(t);
    return o;
  }
  e.append = n;
  function l(o, ...r) {
    const t = new DocumentFragment();
    for (const u of r) t.appendChild(u);
    return o.parentElement && o.parentElement.replaceChild(t, o), t;
  }
  e.replace = l;
  function f(o, ...r) {
    const t = e();
    for (const u of r) t.appendChild(u);
    return o.insertBefore(t, o.firstChild), o;
  }
  e.prepend = f;
  function w(o, r) {
    if (!r) return;
    if (!r[Symbol.iterator]) throw new Error(`Html: non-tuple: ${r}`);
    const [t, ...u] = r;
    if (typeof r[0] != "string") throw new Error(`Html: non-string: ${r[0]}`);
    const { tag: C, id: k, attrs: D = {}, classes: L = [] } = T(t);
    if (C === "svg") {
      const d = _(r);
      o.appendChild(d.firstChild);
      return;
    }
    let h = E(document.createElement(C), D);
    k && (h.id = k);
    for (const d of L) h.classList.add(d);
    for (const d of u) {
      if (!d) return;
      if (typeof d == "string") h.appendChild(document.createTextNode(d));
      else if (typeof d == "object") if (d instanceof Node) h.appendChild(d);
      else if (d[Symbol.iterator]) h.appendChild(e(d));
      else for (const [R, x] of Object.entries(d)) h[R] = x;
      else if (typeof d == "function") h = d(h) ?? h;
      else if (d) throw new Error(`DOM: invalid prop: ${d}`);
    }
    o.appendChild(h);
  }
  e.add = w;
})(m || (m = {}));
const P = { CONNECTED: "\u2B24 Connected to ", CONNECTING: "\u25EF Connecting to ", CONNECT_ERROR: "\u25EF Error, reconnecting to ", SIMPLICITYHL: ["div", ["h2", "Now with SimplicityHL Support!"], ["p", ["a", { href: "https://github.com/hackbg/simf/blob/dev/src/lib.rs" }, ["strong", "Fadroma V3"], " uses WebAssembly"], " to instantly compile, evaluate, and deploy ", ["a", { href: "https://docs.simplicity-lang.org/getting-started/simplicityhl/" }, ["strong", "SimplicityHL"], " smart contracts"], " on ", ["a", { href: "https://liquid.net/" }, "the ", ["strong", "Liquid"], " Network"], ". It works from all modern JavaScript-based environments: browsers, servers, ", ["a", { href: "https://deno.com/deploy" }, "edge cloud"], " \u2014 even this webpage!"], ["p", "The ", ["strong", "Simplicity transaction lifecycle"], " works in two phases. During the ", ["strong", "commitment phase"], " you ", " take a SimplicityHL program, provide parameters, compile it to a P2TR address on a given chain, and commit funds to that address. ", "During the ", ["strong", "redemption phase"], " you compose a transaction that redeems the funds, and provide a matching signature ", "that fulfills the conditions of the program."], ["p", "Try it now with these ", ["strong", "SimplicityHL programs"], " on ", ["a", { href: "https://blockstream.info/liquidtestnet/" }, "Liquid Testnet"], ":"]], README: "Created at https://fadroma.tech", NO_DEPLOYS: "Deploy a program first, using the above form.", DownloadProject: ["p", "Here you can ", ["strong", "download an example project"], " containing the example programs and the following support files:"], CompileTitle: ["span", ["strong", ["span", { style: "float:left;font-size:1.5rem;padding-right:0.33rem" }, "1. "], "Compile program"], " to P2TR address:"], FundTitle: ["span", ["strong", ["span", { style: "float:left;font-size:1.5rem;padding-right:0.33rem" }, "2. "], "Send funds"], " to the program's address:"], WitnessTitle: ["span", ["strong", ["span", { style: "float:left;font-size:1.5rem;padding-right:0.33rem" }, "3. "], "Specify transaction"], " to obtain SIGHASH_ALL:"], RedeemTitle: ["span", ["strong", ["span", { style: "float:left;font-size:1.5rem;padding-right:0.33rem" }, "4. "], "Receive funds"], " by sending valid signatures:"] }, O = { compile: "Compile", commit: "Commit", redeem: "Redeem" }, i = { anchorCrate: "https://docs.rs/anchor-lang/latest/anchor_lang/", btcRpc: "https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_list", btcTest: "https://developer.bitcoin.org/examples/testing.html", codama: "#", denoApi: "https://docs.deno.com/api/deno/", denoStd: "https://docs.deno.com/runtime/reference/std/", direnvWiki: "https://github.com/direnv/direnv/wiki", edConfSpec: "https://spec.editorconfig.org/", elementsRpc: "https://elementsproject.org/en/doc/23.2.1/rpc/", eslintConf: "https://eslint.org/docs/latest/use/configure/", idlGuide: "https://solana.com/developers/guides/advanced/idls", namadaRepo: "https://github.com/namada-net/namada", nixInstall: "https://nixos.org/download/", nixPkgs: "https://search.nixos.org/packages", nodeApi: "https://nodejs.org/api/index.html", pnpmCompare: "https://pnpm.io/feature-comparison", scrtHome: "https://scrt.network/", simfJets: "https://docs.rs/simfony-as-rust/latest/simfony_as_rust/jet/index.html", simfRef: "https://docs.simplicity-lang.org/simplicityhl-reference/", solanaCrate: "https://docs.rs/solana-program/latest/solana_program/", solanaKit: "#", solanaWeb3: "#", tsxNpm: "https://www.npmjs.com/package/tsx" };
function b(e = m.id("sidebar"), s = m.id("features")) {
  return m.on(s, "change", b.updateProjectConfiguration), m.append(s, b.Platforms1()), m.append(s, b.Platforms2()), e;
}
((e) => {
  function s(n) {
    var _a;
    let l = n.target;
    do {
      if ((_a = l == null ? void 0 : l.id) == null ? void 0 : _a.startsWith("enable:")) {
        console.log(l.id);
        return;
      }
      l = l.parentElement;
    } while (l && l !== n.currentTarget);
  }
  e.updateProjectConfiguration = s;
  function c({ open: n = true, name: l = "", help: f = null, features: w = [] }) {
    return ["details", { open: n }, ["summary", l, f ? ["a.help", { target: "_blank", href: f }, "Discuss ", v("github")] : ""], ["ul.features", ...w.map(([o, r, t, ...u]) => (o ? y : y.Disabled)(r, t, ...u))]];
  }
  e.Section = c;
  function a() {
    return m(["ul.features", e.Section({ name: "Bitcoin ecosystem", help: "https://github.com/hackbg/fadroma/discussions/240", features: [[true, 0, "enable:btc", "Bitcoin", ["Develop and test with local bitcoind in ", g(i.btcTest, ["code", "regtest"]), " mode."], ["RPC", i.btcRpc]], [true, 0, "enable:elements", "Elements", ["Develop and test with local elementsd in ", ["code", "elementsregtest"], " mode."], ["RPC", i.elementsRpc]], [true, 0, "enable:simf", "SimplicityHL", ["Compile and run ", g(i.simfRef, "SimplicityHL"), " programs."], ["Language", i.simfRef], ["Jets", i.simfJets]]] }), e.Section({ name: "Solana ecosystem", help: "https://github.com/hackbg/fadroma/discussions/237", features: [[false, 0, "enable:sol", "Solana", "Connect to Solana.", ["Web3", i.solanaWeb3], ["Kit", i.solanaKit]], [false, 1, "enable:sol-prog", "Solana Programs", "Write Solana programs in Rust.", ["Core", i.solanaCrate], ["Codama", i.codama]], [false, 1, "enable:sol-idl", "Solana Anchor IDL", "Integrate with Solana Anchor IDL.", ["IDL", i.idlGuide], ["Anchor", i.anchorCrate]]] }), e.Section({ name: "Cosmos ecosystem", help: "https://github.com/hackbg/fadroma/discussions/238", features: [[false, 0, "enable:tm", "Tendermint", "Connect to for Tendermint, CometBFT, and compatibles."], [false, 1, "enable:namada", "Namada", ["Client and decoder for ", g(i.namadaRepo, "Namada"), "."]], [false, 1, "enable:scrt", "Scrt", ["Client for ", g(i.scrtHome, "Secret"), "."]], [false, 1, "enable:cw", "CosmWasm", "Write contracts for the Cosmos ecosystem."]] })]);
  }
  e.Platforms1 = a;
  function p() {
    return m(["ul.features", e.Section({ name: "DevOps / Unix ecosystem", help: "https://github.com/hackbg/fadroma/discussions/categories/guides", features: [[true, 0, "enable:git", "Git", "Automatically init Git repo in new project."], [true, 0, "enable:nix", "Nix Shell", ["Obtain dependencies from ", g(i.nixPkgs, "nixpkgs")], ["Install", i.nixInstall]], [true, 0, "enable:direnv", "Direnv", ["Automatically load Nix shell when entering project directory."], ["Wiki", i.direnvWiki]], [false, 0, "enable:editorconfig", "EditorConfig", "IDE-agnostic settings.", ["Spec", i.edConfSpec]]] }), e.Section({ name: "JS / TS / ECMAScript ecosystem", help: "https://github.com/hackbg/fadroma/discussions/239", features: [[true, 0, "enable:deno", "Deno", "Run on next-gen TS/JS runtime by default.", ["@std", i.denoStd], ["API", i.denoApi]], [true, 0, "enable:node", "Node.js", ["Will use ", g(i.tsxNpm, "tsx"), " to run TypeScript."], ["API", i.nodeApi]], [true, 0, "enable:pnpm", "PNPM", ["Recommended package manager."], ["Compare", i.pnpmCompare]], [false, 0, "enable:eslint", "ESLint", "Static analyzer.", ["Platforms", i.eslintConf]], [false, 0, "enable:vite", "Vite", "Build your front-end in the same repo."]] }), e.Section({ name: "Rust ecosystem", help: "https://github.com/hackbg/fadroma/discussions/236", features: [[false, 0, "enable:mold", "Mold", "Improves build times."], [false, 0, "enable:rust", "Rust", "Different targets may need different toolchains."]] })]);
  }
  e.Platforms2 = p;
})(b || (b = {}));
function y(e, s, c = "", a = "", ...p) {
  return m([`li.feature[data-depth=${e}]`, ["div.row.between", ["div.col", ["label", ["input[type=checkbox][checked=checked]", { id: s }], c], ["p.grow", ...typeof a == "object" ? a : [a]]], y.Links(p)]]);
}
((e) => {
  function s(a, p, n = "", l = "", ...f) {
    return m([`li.feature.disabled[data-depth=${a}]`, ["div.row.between", ["div.col", ["label", ["input[type=checkbox][disabled=disabled]", { id: p }], n], ["p.grow", ...typeof l == "object" ? l : [l]]], e.Links(f)]]);
  }
  e.Disabled = s;
  function c(a) {
    return ["div.links", ...a.map(([p, n = "#"]) => ["a.flex[target=_blank]", { href: n }, p, v("book")])];
  }
  e.Links = c;
})(y || (y = {}));
function g(e, ...s) {
  return ["a[target=_blank]", { href: e }, ...s];
}
function v(e) {
  return ["svg.icon", [`use[href=icons.svg#${e}]`]];
}
const W = Object.freeze(Object.defineProperty({ __proto__: null, get Feature() {
  return y;
}, Icon: v, Labels: O, Link: g, get Platforms() {
  return b;
}, Texts: P, Urls: i }, Symbol.toStringTag, { value: "Module" }));
export {
  m as H,
  O as L,
  P as T,
  W as c
};
