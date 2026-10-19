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
