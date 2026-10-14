(function () {
  var MC = window.MC, h = MC.h, app = document.getElementById("app");
  var COLS = "id,title,category,edition,game_version,description,cover_url,download_url,source_url,featured,created_at";
  var all = null, state = { cat: "", q: "" };

  function setStatus(node, msg, cls) { MC.clear(node); node.appendChild(h("p", { class: "state " + (cls || "") }, msg)); }

  function skeleton() {
    var g = h("div", { class: "grid" });
    for (var i = 0; i < 8; i++) g.appendChild(h("div", { class: "card skel" }, h("div", { class: "thumb" }), h("div", { class: "body" }, h("div", { class: "line" }), h("div", { class: "line short" }))));
    return g;
  }

  async function loadAll() {
    if (all) return all;
    if (!MC.sb) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Publishable key ໃນ config.js");
    var r = await MC.sb.from("mods").select(COLS).eq("status", "approved").order("created_at", { ascending: false }).limit(500);
    if (r.error) throw r.error;
    all = r.data || [];
    return all;
  }

  function cover(m, cls) {
    var u = MC.safeUrl(m.cover_url);
    if (!u) return h("div", { class: cls + " noimg" }, "⛏");
    return h("img", { class: cls, src: u, alt: m.title + " cover", loading: "lazy", decoding: "async" });
  }

  function badge(t, c) { return t ? h("span", { class: "badge " + (c || "") }, t) : null; }

  function card(m) {
    return h("a", { class: "card", href: "?mod=" + encodeURIComponent(m.id), "data-id": m.id },
      h("div", { class: "thumb" }, cover(m, "cover")),
      h("div", { class: "body" },
        h("h3", {}, m.title),
        h("div", { class: "meta" }, badge(m.category), badge(m.edition, "ed"), badge(m.game_version, "ver"))));
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return all.filter(function (m) {
      if (state.cat && m.category !== state.cat) return false;
      if (q && (m.title + " " + (m.description || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function grid(list) {
    var g = h("div", { class: "grid" });
    list.forEach(function (m) { g.appendChild(card(m)); });
    return g;
  }

  function renderHome() {
    document.title = "MCMods - Minecraft mods, maps, skins & shaders";
    MC.clear(app);
    var list = filtered();
    var searching = state.cat || state.q.trim();
    if (!searching) {
      var feat = all.filter(function (m) { return m.featured; }).slice(0, 8);
      if (feat.length) app.appendChild(h("section", {}, h("h2", {}, "Featured"), grid(feat)));
    }
    var title = state.cat ? state.cat : (state.q.trim() ? "ຜົນການຄົ້ນຫາ" : "Latest");
    var sec = h("section", {}, h("h2", {}, title, h("small", {}, " " + list.length)));
    if (!all.length) sec.appendChild(h("p", { class: "state" }, "ຍັງບໍ່ມີເນື້ອຫາ. ກັບມາເບິ່ງໃໝ່ໃນພາຍຫຼັງ."));
    else if (!list.length) sec.appendChild(h("p", { class: "state" }, "ບໍ່ພົບສິ່ງທີ່ຄົ້ນຫາ."));
    else sec.appendChild(grid(list));
    app.appendChild(sec);
    var slot = h("div", { class: "ad-slot", hidden: true });
    app.appendChild(slot); MC.renderBanner(slot);
  }

  function shareUrl(id) { return location.origin + location.pathname + "?mod=" + encodeURIComponent(id); }

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { var t = h("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (e2) {} t.remove(); }
    if (btn) { var o = btn.textContent; btn.textContent = "ຄັດລອກແລ້ວ ✓"; setTimeout(function () { btn.textContent = o; }, 1800); }
  }

  function shareBox(m) {
    var url = shareUrl(m.id), text = m.title + " - MCMods";
    var panel = h("div", { class: "share-panel", hidden: true });
    var copyBtn = h("button", { class: "btn ghost", type: "button", onclick: function () { copy(url, copyBtn); } }, "ຄັດລອກລິ້ງ");
    panel.appendChild(copyBtn);
    panel.appendChild(h("a", { class: "btn ghost", target: "_blank", rel: "noopener noreferrer", href: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url) }, "Facebook"));
    panel.appendChild(h("a", { class: "btn ghost", target: "_blank", rel: "noopener noreferrer", href: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url) }, "X"));
    ["Instagram", "TikTok", "YouTube"].forEach(function (n) {
      var b = h("button", { class: "btn ghost", type: "button", onclick: function () { copy(url, b); note.hidden = false; } }, n);
      panel.appendChild(b);
    });
    var note = h("p", { class: "hint", hidden: true }, "Instagram, TikTok ແລະ YouTube ບໍ່ມີລິ້ງແຊຣ໌ໂດຍກົງ. ລິ້ງຖືກຄັດລອກແລ້ວ - ເປີດແອັບນັ້ນແລ້ວວາງລິ້ງໃນໂພສຂອງເຈົ້າ.");
    panel.appendChild(note);
    var main = h("button", { class: "btn ghost", type: "button", onclick: async function () {
      if (navigator.share) { try { await navigator.share({ title: m.title, text: text, url: url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      panel.hidden = !panel.hidden;
    } }, "⤴ Share");
    return h("div", { class: "share" }, main, panel);
  }

  function renderDetail(m) {
    document.title = m.title + " - MCMods";
    MC.clear(app);
    var dl = MC.safeUrl(m.download_url), src = MC.safeUrl(m.source_url);
    var spons = MC.C.SPONSOR || {}, sponsUrl = spons.enabled ? MC.safeUrl(spons.url) : null;
    var actions = h("div", { class: "actions" });
    if (dl) actions.appendChild(h("a", { class: "btn primary", href: dl, target: "_blank", rel: "noopener noreferrer" }, "⬇ Download"));
    if (src) actions.appendChild(h("a", { class: "btn", href: src, target: "_blank", rel: "nofollow noopener noreferrer" }, "Visit Original"));
    if (!dl && !src) actions.appendChild(h("p", { class: "state" }, "ຍັງບໍ່ມີລິ້ງດາວໂຫຼດສຳລັບລາຍການນີ້."));
    actions.appendChild(shareBox(m));
    var box = h("article", { class: "detail" },
      h("a", { class: "back", href: location.pathname }, "← ກັບໜ້າຫຼັກ"),
      h("div", { class: "hero" }, cover(m, "cover")),
      h("h1", {}, m.title),
      h("div", { class: "meta" }, badge(m.category), badge(m.edition, "ed"), badge(m.game_version ? "Minecraft " + m.game_version : "", "ver")),
      actions);
    if (sponsUrl && (dl || src)) {
      box.appendChild(h("p", { class: "sponsor" }, "ການສະໜັບສະໜູນ (ບໍ່ບັງຄັບ): ",
        h("a", { href: sponsUrl, target: "_blank", rel: "sponsored noopener noreferrer" }, "ເບິ່ງລິ້ງຜູ້ສະໜັບສະໜູນ"),
        " - ປຸ່ມ Download ດ້ານເທິງໃຊ້ໄດ້ທັນທີ."));
    }
    box.appendChild(h("h2", {}, "ລາຍລະອຽດ"));
    box.appendChild(h("p", { class: "desc" }, m.description || "ບໍ່ມີຄຳອະທິບາຍ."));
    if (src) box.appendChild(h("p", { class: "hint" }, "ຕົ້ນສະບັບ: ", (function () { try { return new URL(src).hostname; } catch (e) { return src; } })()));
    app.appendChild(box);
    var slot = h("div", { class: "ad-slot", hidden: true });
    app.appendChild(slot); MC.renderBanner(slot);
    window.scrollTo(0, 0);
  }

  async function route() {
    var id = new URLSearchParams(location.search).get("mod");
    MC.clear(app); app.appendChild(skeleton());
    try {
      if (!id) { await loadAll(); renderHome(); return; }
      var m = all && all.find(function (x) { return String(x.id) === id; });
      if (!m) {
        if (!MC.sb) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Publishable key ໃນ config.js");
        var r = await MC.sb.from("mods").select(COLS).eq("id", id).eq("status", "approved").maybeSingle();
        if (r.error) throw r.error; m = r.data;
      }
      if (!m) { setStatus(app, "ບໍ່ພົບລາຍການນີ້ (ອາດຖືກລຶບ ຫຼື ຍັງບໍ່ເຜີຍແຜ່).", "err"); app.appendChild(h("a", { class: "btn", href: location.pathname }, "ກັບໜ້າຫຼັກ")); return; }
      renderDetail(m);
    } catch (e) {
      MC.clear(app);
      app.appendChild(h("p", { class: "state err" }, "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ: " + (e && e.message ? e.message : e)));
      app.appendChild(h("button", { class: "btn", type: "button", onclick: route }, "ລອງໃໝ່"));
    }
  }

  // nav
  var nav = document.getElementById("cats");
  function navBtn(label, val) {
    var b = h("button", { type: "button", class: "chip", "aria-pressed": "false", onclick: function () {
      state.cat = state.cat === val ? "" : val; syncNav();
      if (new URLSearchParams(location.search).get("mod")) history.pushState({}, "", location.pathname);
      if (all) { renderHome(); } else route();
    } }, label);
    b.dataset.val = val; return b;
  }
  function syncNav() { Array.prototype.forEach.call(nav.children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.val === state.cat && !!state.cat)); }); }
  MC.CATEGORIES.forEach(function (c) { nav.appendChild(navBtn(c, c)); });

  var q = document.getElementById("q"), tmr;
  q.addEventListener("input", function () {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      state.q = q.value;
      if (new URLSearchParams(location.search).get("mod")) history.pushState({}, "", location.pathname);
      if (all) renderHome(); else route();
    }, 200);
  });
  document.getElementById("brand").addEventListener("click", function (e) {
    e.preventDefault(); state.cat = ""; state.q = ""; q.value = ""; syncNav();
    history.pushState({}, "", location.pathname); route();
  });

  app.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.card");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); history.pushState({}, "", a.getAttribute("href")); route();
  });
  window.addEventListener("popstate", route);

  // footer
  var soc = document.getElementById("social"), S = MC.C.SOCIAL || {}, names = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X" };
  Object.keys(names).forEach(function (k) { var u = MC.safeUrl(S[k]); if (u) soc.appendChild(h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, names[k])); });
  var cu = MC.C.CONTACT; if (cu && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cu)) document.getElementById("contact").appendChild(h("a", { href: "mailto:" + cu }, cu));
  document.getElementById("year").textContent = new Date().getFullYear();

  route();
})();
