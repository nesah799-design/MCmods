(function () {
  var C = window.MCMODS_CONFIG || {};
  var configured = !!(C.SUPABASE_URL && C.SUPABASE_KEY && C.SUPABASE_KEY.indexOf("PASTE") !== 0);

  // ===== ຕົວເຊື່ອມຕໍ່ Supabase ແບບເບົາ (ບໍ່ຕ້ອງໂຫຼດໄລບຣາຣີຈາກພາຍນອກ) =====
  var SKEY = "mcmods.session";
  function loadSess() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function saveSess(s) { try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {} }
  function errMsg(j, r) { return (j && (j.msg || j.message || j.error_description || j.error)) || ("HTTP " + r.status); }

  function makeClient(url, key) {
    function jsonFetch(path, opts) {
      return fetch(url + path, opts).then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          return { r: r, j: j };
        });
      });
    }
    async function session() {
      var s = loadSess();
      if (!s) return null;
      if (s.expires_at && s.expires_at * 1000 < Date.now() + 30000) {
        try {
          var x = await jsonFetch("/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
          if (!x.r.ok || !x.j || !x.j.access_token) { saveSess(null); return null; }
          s = { access_token: x.j.access_token, refresh_token: x.j.refresh_token, expires_at: x.j.expires_at || (Math.floor(Date.now() / 1000) + (x.j.expires_in || 3600)), user: x.j.user || s.user };
          saveSess(s);
        } catch (e) { return s; }
      }
      return s;
    }
    async function headers(extra) {
      var h = { apikey: key };
      var s = await session();
      if (s) h.Authorization = "Bearer " + s.access_token;
      for (var k in extra) h[k] = extra[k];
      return h;
    }

    function from(table) {
      var q = { mode: "select", select: "*", filters: [], order: "", limit: "", single: false, body: null };
      var b = {
        select: function (c) { q.select = c; return b; },
        insert: function (row) { q.mode = "insert"; q.body = row; return b; },
        update: function (row) { q.mode = "update"; q.body = row; return b; },
        delete: function () { q.mode = "delete"; return b; },
        eq: function (k, v) { q.filters.push(encodeURIComponent(k) + "=eq." + encodeURIComponent(v)); return b; },
        order: function (c, o) { q.order = "&order=" + encodeURIComponent(c) + (o && o.ascending === false ? ".desc" : ".asc"); return b; },
        limit: function (n) { q.limit = "&limit=" + Number(n); return b; },
        maybeSingle: function () { q.single = true; q.limit = "&limit=1"; return run(); },
        then: function (res, rej) { return run().then(res, rej); }
      };
      async function run() {
        try {
          var u = "/rest/v1/" + encodeURIComponent(table), f = q.filters.length ? q.filters.join("&") : "";
          var opts;
          if (q.mode === "select") {
            u += "?select=" + encodeURIComponent(q.select) + (f ? "&" + f : "") + q.order + q.limit;
            opts = { method: "GET", headers: await headers({ Accept: "application/json" }) };
          } else if (q.mode === "insert") {
            opts = { method: "POST", headers: await headers({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(q.body) };
          } else {
            if (!f) return { data: null, error: { message: "ຕ້ອງມີເງື່ອນໄຂ (eq) ສຳລັບແກ້ໄຂ/ລຶບ" } };
            u += "?" + f;
            opts = q.mode === "update"
              ? { method: "PATCH", headers: await headers({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(q.body) }
              : { method: "DELETE", headers: await headers({ Prefer: "return=minimal" }) };
          }
          var x = await jsonFetch(u, opts);
          if (!x.r.ok) return { data: null, error: { message: errMsg(x.j, x.r) } };
          if (q.mode !== "select") return { data: null, error: null };
          return { data: q.single ? ((x.j && x.j[0]) || null) : (x.j || []), error: null };
        } catch (e) { return { data: null, error: { message: e.message || "ເຊື່ອມຕໍ່ບໍ່ໄດ້" } }; }
      }
      return b;
    }

    var auth = {
      getSession: async function () { var s = await session(); return { data: { session: s } }; },
      signInWithPassword: async function (c) {
        try {
          var x = await jsonFetch("/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email: c.email, password: c.password }) });
          if (!x.r.ok || !x.j || !x.j.access_token) return { data: null, error: { message: errMsg(x.j, x.r) } };
          var s = { access_token: x.j.access_token, refresh_token: x.j.refresh_token, expires_at: x.j.expires_at || (Math.floor(Date.now() / 1000) + (x.j.expires_in || 3600)), user: x.j.user };
          saveSess(s);
          return { data: { session: s }, error: null };
        } catch (e) { return { data: null, error: { message: e.message || "ເຊື່ອມຕໍ່ບໍ່ໄດ້" } }; }
      },
      signOut: async function () {
        try { var s = loadSess(); if (s) await fetch(url + "/auth/v1/logout", { method: "POST", headers: { apikey: key, Authorization: "Bearer " + s.access_token } }); } catch (e) {}
        saveSess(null); return { error: null };
      }
    };

    async function rpc(name, args) {
      try {
        var x = await jsonFetch("/rest/v1/rpc/" + encodeURIComponent(name), { method: "POST", headers: await headers({ "Content-Type": "application/json" }), body: JSON.stringify(args || {}) });
        if (!x.r.ok) return { data: null, error: { message: errMsg(x.j, x.r) } };
        return { data: x.j, error: null };
      } catch (e) { return { data: null, error: { message: e.message || "ເຊື່ອມຕໍ່ບໍ່ໄດ້" } }; }
    }

    function encPath(p) { return p.split("/").map(encodeURIComponent).join("/"); }
    var storage = { from: function (bucket) {
      return {
        upload: async function (path, file, o) {
          o = o || {};
          try {
            var x = await jsonFetch("/storage/v1/object/" + encodeURIComponent(bucket) + "/" + encPath(path), { method: "POST",
              headers: await headers({ "Content-Type": o.contentType || file.type || "application/octet-stream", "x-upsert": o.upsert ? "true" : "false", "cache-control": "max-age=" + (o.cacheControl || "3600") }), body: file });
            if (!x.r.ok) return { data: null, error: { message: errMsg(x.j, x.r) } };
            return { data: { path: path }, error: null };
          } catch (e) { return { data: null, error: { message: e.message || "ອັບໂຫຼດບໍ່ສຳເລັດ" } }; }
        },
        getPublicUrl: function (path) { return { data: { publicUrl: url + "/storage/v1/object/public/" + encodeURIComponent(bucket) + "/" + encPath(path) } }; },
        remove: async function (paths) {
          try {
            var x = await jsonFetch("/storage/v1/object/" + encodeURIComponent(bucket), { method: "DELETE", headers: await headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: paths }) });
            return { data: null, error: x.r.ok ? null : { message: errMsg(x.j, x.r) } };
          } catch (e) { return { data: null, error: { message: e.message } }; }
        }
      };
    } };

    return { from: from, auth: auth, rpc: rpc, storage: storage };
  }

  var sb = configured ? makeClient(C.SUPABASE_URL, C.SUPABASE_KEY) : null;

  function h(tag, props) {
    var e = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else e.setAttribute(k, v === true ? "" : v);
    });
    function add(c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }

  // ອະນຸຍາດສະເພາະ http/https
  function safeUrl(u) {
    if (!u || typeof u !== "string") return null;
    try {
      var x = new URL(u.trim());
      return x.protocol === "https:" || x.protocol === "http:" ? x.href : null;
    } catch (e) { return null; }
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function renderBanner(slot) {
    var a = C.ADS || {};
    if (!a.bannerEnabled || !a.bannerHtml) { slot.hidden = true; return; }
    slot.hidden = false;
    clear(slot);
    slot.appendChild(h("span", { class: "ad-label" }, "ໂຄສະນາ"));
    var f = h("iframe", { title: "ໂຄສະນາ", loading: "lazy", sandbox: "allow-scripts allow-popups", class: "ad-frame" });
    f.srcdoc = a.bannerHtml;
    slot.appendChild(f);
  }

  window.MC = { C: C, configured: configured, sb: sb, h: h, safeUrl: safeUrl, clear: clear, renderBanner: renderBanner,
    CATEGORIES: ["Mods", "Addons", "Maps", "Skins", "Shaders", "Texture Packs"],
    EDITIONS: ["Java", "Bedrock", "Both"], STATUSES: ["pending", "approved", "rejected"] };
})();
    
