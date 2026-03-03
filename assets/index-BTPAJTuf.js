const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-GVCbR69S.js","assets/index-DsRfobeB.js","assets/cons-C8nhYyWL.js","assets/index-CtQ99MjB.js","assets/index-Ck3IbhyB.css"])))=>i.map(i=>d[i]);
let m;
let __tla = (async () => {
  (function() {
    const s = document.createElement("link").relList;
    if (s && s.supports && s.supports("modulepreload")) return;
    for (const e of document.querySelectorAll('link[rel="modulepreload"]')) d(e);
    new MutationObserver((e) => {
      for (const r of e) if (r.type === "childList") for (const n of r.addedNodes) n.tagName === "LINK" && n.rel === "modulepreload" && d(n);
    }).observe(document, {
      childList: true,
      subtree: true
    });
    function l(e) {
      const r = {};
      return e.integrity && (r.integrity = e.integrity), e.referrerPolicy && (r.referrerPolicy = e.referrerPolicy), e.crossOrigin === "use-credentials" ? r.credentials = "include" : e.crossOrigin === "anonymous" ? r.credentials = "omit" : r.credentials = "same-origin", r;
    }
    function d(e) {
      if (e.ep) return;
      e.ep = true;
      const r = l(e);
      fetch(e.href, r);
    }
  })();
  let g, v, f;
  g = "modulepreload";
  v = function(t) {
    return "/" + t;
  };
  f = {};
  m = function(s, l, d) {
    let e = Promise.resolve();
    if (l && l.length > 0) {
      let h = function(o) {
        return Promise.all(o.map((u) => Promise.resolve(u).then((a) => ({
          status: "fulfilled",
          value: a
        }), (a) => ({
          status: "rejected",
          reason: a
        }))));
      };
      document.getElementsByTagName("link");
      const n = document.querySelector("meta[property=csp-nonce]"), c = (n == null ? void 0 : n.nonce) || (n == null ? void 0 : n.getAttribute("nonce"));
      e = h(l.map((o) => {
        if (o = v(o), o in f) return;
        f[o] = true;
        const u = o.endsWith(".css"), a = u ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${o}"]${a}`)) return;
        const i = document.createElement("link");
        if (i.rel = u ? "stylesheet" : g, u || (i.as = "script"), i.crossOrigin = "", i.href = o, c && i.setAttribute("nonce", c), document.head.appendChild(i), u) return new Promise((y, E) => {
          i.addEventListener("load", y), i.addEventListener("error", () => E(new Error(`Unable to preload CSS for ${o}`)));
        });
      }));
    }
    function r(n) {
      const c = new Event("vite:preloadError", {
        cancelable: true
      });
      if (c.payload = n, window.dispatchEvent(c), !c.defaultPrevented) throw n;
    }
    return e.then((n) => {
      for (const c of n || []) c.status === "rejected" && r(c.reason);
      return s().catch(r);
    });
  };
  function p(t, s = P, l = _) {
    return t.then(s).catch(l);
  }
  function P({ default: t }) {
    return t();
  }
  function _(t) {
    console.error(t);
    const s = Object.assign(document.createElement("pre"), {
      innerText: t.stack
    });
    document.getElementById("editors").innerText = "", document.getElementById("editors").appendChild(s);
  }
  p(m(() => import("./cons-C8nhYyWL.js").then((t) => t.c), []), ({ Platforms: t }) => t());
  p(m(() => import("./index-GVCbR69S.js").then(async (m2) => {
    await m2.__tla;
    return m2;
  }).then((t) => t.i), __vite__mapDeps([0,1,2,3,4])));
})();
export {
  m as _,
  __tla
};
