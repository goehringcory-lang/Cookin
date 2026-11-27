function cokkinSync() {
  (async function () {
    var d = document;
    var old = d.getElementById("cokkin-sync");
    if (old) old.remove();
    var ov = d.createElement("div");
    ov.id = "cokkin-sync";
    ov.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:2147483647;background:#fff;color:#1d2420;border:2px solid #2e6b4a;border-radius:14px;padding:16px;font:15px/1.45 -apple-system,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:10px;max-width:560px;margin:0 auto;max-height:85vh;overflow:auto";
    var h = d.createElement("strong");
    h.textContent = "Sync to Cokkin";
    var msg = d.createElement("div");
    var btns = d.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    ov.appendChild(h); ov.appendChild(msg); ov.appendChild(btns);
    d.body.appendChild(ov);
    function say(t) { msg.textContent = t; }
    function button(label, fn, primary) {
      var b = d.createElement("button");
      b.textContent = label;
      b.style.cssText = "font:inherit;padding:9px 14px;border-radius:10px;border:1px solid #2e6b4a;cursor:pointer;" + (primary ? "background:#2e6b4a;color:#fff" : "background:#fff;color:#2e6b4a");
      b.onclick = fn;
      btns.appendChild(b);
      return b;
    }
    button("Close", function () { ov.remove(); });
    if (!/(^|\.)cooking\.nytimes\.com$/.test(location.hostname)) {
      say("Open cooking.nytimes.com/recipe-box while signed in, then tap Sync to Cokkin again.");
      return;
    }
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var root = d.querySelector("main") || d.body;
    var linkSel = 'a[href*="/recipes/"]';
    var count = function () { return root.querySelectorAll(linkSel).length; };
    var last = -1, same = 0;
    for (var i = 0; i < 80 && same < 4; i++) {
      say("Loading your Recipe Box… " + count() + " links found");
      window.scrollTo(0, d.documentElement.scrollHeight);
      Array.prototype.forEach.call(root.querySelectorAll("button"), function (b) {
        if (/^(load|show|see) more/i.test((b.textContent || "").trim())) b.click();
      });
      await wait(900);
      var n = count();
      if (n === last) same++; else { same = 0; last = n; }
    }
    var seen = {}, urls = [];
    Array.prototype.forEach.call(root.querySelectorAll(linkSel), function (a) {
      var u = a.href.split(/[?#]/)[0];
      var m = u.match(/\/recipes\/(\d+)/);
      if (m && !seen[m[1]]) { seen[m[1]] = 1; urls.push(u); }
    });
    if (!urls.length) {
      say("No saved recipes found on this page. Open your Recipe Box (cooking.nytimes.com/recipe-box) and try again.");
      return;
    }
    var dec = function (s) { var t = d.createElement("textarea"); t.innerHTML = String(s || ""); return t.value.trim(); };
    var out = [], next = 0, done = 0, failed = 0;
    async function worker() {
      while (next < urls.length) {
        var u = urls[next++];
        try {
          var html = await (await fetch(u, { credentials: "include" })).text();
          var doc = new DOMParser().parseFromString(html, "text/html");
          var rec = null;
          Array.prototype.forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), function (s) {
            try {
              var j = JSON.parse(s.textContent);
              [].concat(j && j["@graph"] ? j["@graph"] : j).forEach(function (x) {
                if (x && [].concat(x["@type"]).indexOf("Recipe") > -1) rec = x;
              });
            } catch (e) {}
          });
          if (rec && rec.recipeIngredient && rec.recipeIngredient.length) {
            out.push({
              id: "nyt-" + u.match(/\/recipes\/(\d+)/)[1],
              url: u,
              title: dec(rec.name),
              ing: rec.recipeIngredient.map(dec).filter(Boolean),
              time: rec.totalTime || rec.cookTime || "",
              yield: dec([].concat(rec.recipeYield || "")[0]),
              cat: dec([].concat(rec.recipeCategory || "").join(", "))
            });
          } else failed++;
        } catch (e) { failed++; }
        done++;
        say("Reading recipes… " + done + " of " + urls.length);
        await wait(150);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    var json = JSON.stringify({ cokkin: 1, exportedAt: Date.now(), total: urls.length, recipes: out });
    say("Read " + out.length + " recipes" + (failed ? " (" + failed + " could not be read)" : "") + ". Tap Copy, then open Cokkin and tap Paste from NYT.");
    var ta = d.createElement("textarea");
    ta.value = json; ta.readOnly = true;
    ta.style.cssText = "width:100%;height:80px;font:12px monospace;border:1px solid #ccc;border-radius:8px";
    ov.insertBefore(ta, btns);
    var cb = button("Copy", async function () {
      try { await navigator.clipboard.writeText(json); cb.textContent = "Copied"; }
      catch (e) { ta.focus(); ta.select(); try { d.execCommand("copy"); cb.textContent = "Copied"; } catch (e2) { say("Select the text box and copy it."); } }
    }, true);
    btns.insertBefore(cb, btns.firstChild);
  })();
}
