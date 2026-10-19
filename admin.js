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
  }

  function coverPath(url) {
    var key = "/storage/v1/object/public/" + BUCKET + "/", i = url ? url.indexOf(key) : -1;
    return i < 0 ? null : decodeURIComponent(url.slice(i + key.length).split("?")[0]);
  }
  function removeCover(url) { var p = coverPath(url); if (p) sb.storage.from(BUCKET).remove([p]); }

  var signedIn = false, formMod = null;
  window.addEventListener("popstate", function () {
    if (!signedIn) return;
    if (location.hash === "#form") showForm(formMod); else dashboard();
  });

  // ===== ໜ້າລາຍການ =====
  async function dashboard() {
