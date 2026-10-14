(function () {
  var C = window.MCMODS_CONFIG || {};
  var configured = !!(C.SUPABASE_URL && C.SUPABASE_KEY && C.SUPABASE_KEY.indexOf("PASTE") !== 0);
  var sb = null;
  if (configured && window.supabase) sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);

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
