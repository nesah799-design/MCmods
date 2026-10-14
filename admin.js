(function () {
  var MC = window.MC, h = MC.h, sb = MC.sb, root = document.getElementById("root");
  var who = document.getElementById("who"), out = document.getElementById("out");
  var BUCKET = "mod-covers", MAXIMG = 3 * 1024 * 1024, EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

  function msg(node, text, cls) { MC.clear(node); if (text) node.appendChild(h("div", { class: "msg " + (cls || "") }, text)); }

  async function start() {
    MC.clear(root);
    if (!sb) { root.appendChild(h("p", { class: "msg err" }, "ຕັ້ງຄ່າ SUPABASE_KEY ໃນ config.js ກ່ອນ.")); return; }
    var s = await sb.auth.getSession();
    if (!s.data.session) return loginView();
    var o = await sb.rpc("is_owner");
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

  async function dashboard() {
    MC.clear(root);
    var formHost = h("div"), listHost = h("div"), top = h("div", { class: "actions" });
    top.appendChild(h("button", { class: "btn primary", type: "button", onclick: function () { editForm(null); } }, "+ ເພີ່ມ Mod ໃໝ່"));
    root.appendChild(top); root.appendChild(formHost); root.appendChild(h("h2", {}, "ລາຍການທັງໝົດ")); root.appendChild(listHost);

    async function refresh() {
      MC.clear(listHost); listHost.appendChild(h("p", { class: "state" }, "ກຳລັງໂຫຼດ..."));
      var r = await sb.from("mods").select("id,title,category,edition,game_version,description,cover_url,download_url,source_url,featured,status,created_at").order("created_at", { ascending: false });
      MC.clear(listHost);
      if (r.error) return listHost.appendChild(h("p", { class: "msg err" }, "ໂຫຼດບໍ່ສຳເລັດ: " + r.error.message));
      if (!r.data.length) return listHost.appendChild(h("p", { class: "state" }, "ຍັງບໍ່ມີລາຍການ."));
      var list = h("div", { class: "list" });
      r.data.forEach(function (m) {
        var cu = MC.safeUrl(m.cover_url);
        var sel = h("select", { "aria-label": "ສະຖານະ", onchange: async function () {
          var u = await sb.from("mods").update({ status: sel.value }).eq("id", m.id);
          if (u.error) { alert("ປ່ຽນສະຖານະບໍ່ສຳເລັດ: " + u.error.message); sel.value = m.status; } else { m.status = sel.value; st.className = "st-" + m.status; st.textContent = m.status; }
        } }, MC.STATUSES.map(function (s) { return h("option", { value: s, selected: s === m.status }, s); }));
        var st = h("span", { class: "st-" + m.status }, m.status);
        list.appendChild(h("div", { class: "item" }, cu ? h("img", { src: cu, alt: "", loading: "lazy" }) : h("div", { class: "ph" }),
          h("div", { class: "t" }, m.title, h("small", {}, [m.category, m.edition, m.game_version].filter(Boolean).join(" · ") + " · "), st),
          sel,
          h("button", { class: "btn", type: "button", onclick: function () { editForm(m); } }, "ແກ້ໄຂ"),
          h("button", { class: "btn danger", type: "button", onclick: async function () {
            if (!confirm("ລຶບ \"" + m.title + "\" ຖາວອນ?")) return;
            var d = await sb.from("mods").delete().eq("id", m.id);
            if (d.error) return alert("ລຶບບໍ່ສຳເລັດ: " + d.error.message);
            removeCover(m.cover_url); refresh();
          } }, "ລຶບ")));
      });
      listHost.appendChild(list);
    }

    function coverPath(url) {
      var key = "/storage/v1/object/public/" + BUCKET + "/", i = url ? url.indexOf(key) : -1;
      return i < 0 ? null : decodeURIComponent(url.slice(i + key.length).split("?")[0]);
    }
    function removeCover(url) { var p = coverPath(url); if (p) sb.storage.from(BUCKET).remove([p]); }

    function editForm(m) {
      MC.clear(formHost);
      var isNew = !m; m = m || { category: "Mods", edition: "Java", status: "pending" };
      var res = h("div"), saveBtn;
      var f = {
        title: h("input", { required: true, maxlength: 120, value: m.title || "" }),
        category: h("select", {}, MC.CATEGORIES.map(function (c) { return h("option", { value: c, selected: c === m.category }, c); })),
        edition: h("select", {}, MC.EDITIONS.map(function (c) { return h("option", { value: c, selected: c === m.edition }, c); })),
        ver: h("input", { maxlength: 40, placeholder: "ຕົວຢ່າງ 1.21.4", value: m.game_version || "" }),
        desc: h("textarea", { maxlength: 5000 }),
        file: h("input", { type: "file", accept: "image/jpeg,image/png,image/webp" }),
        dl: h("input", { type: "url", placeholder: "https://...", value: m.download_url || "" }),
        src: h("input", { type: "url", placeholder: "https://...", value: m.source_url || "" }),
        status: h("select", {}, MC.STATUSES.map(function (c) { return h("option", { value: c, selected: c === m.status }, c === "approved" ? "approved (ເຜີຍແຜ່)" : c); })),
        feat: h("input", { type: "checkbox", style: "width:auto;min-height:auto" })
      };
      f.desc.value = m.description || ""; f.feat.checked = !!m.featured;
      var cu = MC.safeUrl(m.cover_url);
      var form = h("form", { class: "panel form", novalidate: true, onsubmit: async function (e) {
        e.preventDefault();
        var title = f.title.value.trim(), dl = f.dl.value.trim(), src = f.src.value.trim();
        if (!title) return msg(res, "ໃສ່ຊື່ກ່ອນ.", "err");
        if (dl && !MC.safeUrl(dl)) return msg(res, "ລິ້ງດາວໂຫຼດຕ້ອງເລີ່ມດ້ວຍ http:// ຫຼື https://", "err");
        if (src && !MC.safeUrl(src)) return msg(res, "ລິ້ງຕົ້ນສະບັບຕ້ອງເລີ່ມດ້ວຍ http:// ຫຼື https://", "err");
        var file = f.file.files[0];
        if (file && (!EXT[file.type] || file.size > MAXIMG)) return msg(res, "ຮູບຕ້ອງເປັນ JPG/PNG/WEBP ແລະ ບໍ່ເກີນ 3MB.", "err");
        saveBtn.disabled = true; msg(res, "ກຳລັງບັນທຶກ...");
        var coverUrl = m.cover_url || null, oldCover = null;
        if (file) {
          var path = "covers/" + crypto.randomUUID() + "." + EXT[file.type];
          var up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
          if (up.error) { saveBtn.disabled = false; return msg(res, "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ: " + up.error.message, "err"); }
          oldCover = m.cover_url; coverUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        }
        var row = { title: title, category: f.category.value, edition: f.edition.value, game_version: f.ver.value.trim() || null,
          description: f.desc.value.trim() || null, cover_url: coverUrl, download_url: dl || null, source_url: src || null,
          status: f.status.value, featured: f.feat.checked };
        var r = isNew ? await sb.from("mods").insert(row) : await sb.from("mods").update(row).eq("id", m.id);
        saveBtn.disabled = false;
        if (r.error) return msg(res, "ບັນທຶກບໍ່ສຳເລັດ: " + r.error.message, "err");
        if (oldCover) removeCover(oldCover);
        MC.clear(formHost); refresh();
      } },
        h("h2", { style: "margin:0" }, isNew ? "ເພີ່ມ Mod ໃໝ່" : "ແກ້ໄຂ Mod"),
        h("label", { class: "f" }, "ຊື່", f.title),
        h("div", { class: "row2" }, h("label", { class: "f" }, "ໝວດ", f.category), h("label", { class: "f" }, "Edition", f.edition)),
        h("label", { class: "f" }, "ເວີຊັນ Minecraft", f.ver),
        h("label", { class: "f" }, "ຄຳອະທິບາຍ", f.desc),
        h("label", { class: "f" }, "ຮູບ Cover (JPG/PNG/WEBP, ≤3MB)", cu ? h("img", { src: cu, alt: "", style: "width:160px;border-radius:8px" }) : null, f.file),
        h("label", { class: "f" }, "ລິ້ງດາວໂຫຼດໂດຍກົງ (ໄຟລ໌ຕົວຈິງ, ເລືອກໄດ້)", f.dl),
        h("label", { class: "f" }, "ລິ້ງຕົ້ນສະບັບຂອງຜູ້ສ້າງ (ເລືອກໄດ້)", f.src),
        h("div", { class: "row2" }, h("label", { class: "f" }, "ສະຖານະ", f.status), h("label", { class: "f" }, "Featured ໜ້າຫຼັກ", f.feat)),
        h("div", { class: "actions" }, (saveBtn = h("button", { class: "btn primary", type: "submit" }, "ບັນທຶກ")), h("button", { class: "btn ghost", type: "button", onclick: function () { MC.clear(formHost); } }, "ຍົກເລີກ")),
        res);
      formHost.appendChild(form); form.scrollIntoView({ behavior: "smooth" });
    }
    refresh();
  }
  start();
})();
