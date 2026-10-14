(function () {
  var MC = window.MC, h = MC.h, sb = MC.sb, root = document.getElementById("root");
  var who = document.getElementById("who"), out = document.getElementById("out");
  var BUCKET = "mod-covers", MAXIMG = 3 * 1024 * 1024, EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  function msg(node, text, cls) { MC.clear(node); if (text) node.appendChild(h("div", { class: "msg " + (cls || "") }, text)); }

  function showErr(e) {
    MC.clear(root);
    root.appendChild(h("p", { class: "msg err" }, "ມີຂໍ້ຜິດພາດ: " + (e && e.message ? e.message : e)));
    root.appendChild(h("button", { class: "btn", type: "button", onclick: function () { location.reload(); } }, "ລອງໃໝ່"));
  }
  window.addEventListener("error", function (ev) { showErr(ev.message); });
  window.addEventListener("unhandledrejection", function (ev) { showErr(ev.reason); });

  async function start() {
    MC.clear(root);
    root.appendChild(h("p", { class: "state" }, "ກຳລັງໂຫຼດ..."));
    if (!sb) { MC.clear(root); root.appendChild(h("p", { class: "msg err" }, "ຕັ້ງຄ່າ SUPABASE_KEY ໃນ config.js ກ່ອນ.")); return; }
    var s = await sb.auth.getSession();
    MC.clear(root);
    if (!s.data.session) return loginView();
    var o = await sb.rpc("is_owner");
    MC.clear(root);
    if (o.error || o.data !== true) {
      who.textContent = s.data.session.user.email; out.hidden = false;
      root.appendChild(h("p", { class: "msg err" }, "ບັນຊີນີ້ບໍ່ແມ່ນເຈົ້າຂອງເວັບ. ກວດວ່າ run sql/2-security.sql ດ້ວຍອີເມວທີ່ຖືກຕ້ອງແລ້ວ."));
      return;
    }
    who.textContent = s.data.session.user.email; out.hidden = false;
    dashboard();
  }
  out.addEventListener("click", async function () { await sb.auth.signOut(); out.hidden = true; who.textContent = ""; start(); });

  function loginView() {
    var m = h("div"), em = h("input", { type: "email", required: true, autocomplete: "username" }), pw = h("input", { type: "password", required: true, autocomplete: "current-password" });
    var f = h("form", { class: "panel form", onsubmit: async function (e) {
      e.preventDefault(); msg(m, "ກຳລັງເຂົ້າສູ່ລະບົບ...");
      var r = await sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
      if (r.error) return msg(m, "ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ: " + r.error.message, "err");
      start();
    } }, h("h2", { style: "margin:0" }, "ເຂົ້າສູ່ລະບົບເຈົ້າຂອງ"),
      h("label", { class: "f" }, "ອີເມວ", em), h("label", { class: "f" }, "ລະຫັດຜ່ານ", pw),
      h("button", { class: "btn primary", type: "submit" }, "ເຂົ້າສູ່ລະບົບ"), m);
    root.appendChild(f);
