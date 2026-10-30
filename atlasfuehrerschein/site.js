(function () {
  "use strict";
  var HS = window.H5PStandalone;

  // absolute Pfade (inkl. Unterordner, z. B. bei GitHub Pages /repo/)
  function abs(p) { return new URL(p, location.href).pathname.replace(/\/$/, ""); }

  // ---------- H5P: erst laden, wenn die Übung in Sichtweite kommt
  function loadH5P(el) {
    if (el.dataset.loaded) return;
    el.dataset.loaded = "1";
    if (!HS) {
      el.innerHTML = '<div class="h5p-loading">Der H5P-Player konnte nicht geladen werden.</div>';
      return;
    }
    if (location.protocol === "file:") {
      el.innerHTML = '<div class="h5p-loading">Interaktive Übungen funktionieren nur, wenn die Website über einen Webserver ' +
        'aufgerufen wird (z.&nbsp;B. GitHub Pages) – nicht per Doppelklick auf die Datei.</div>';
      return;
    }
    var opts = {
      h5pJsonPath: abs(el.dataset.path),
      librariesPath: abs("h5p/libraries"),
      frameJs: abs("h5p-player/frame.bundle.js"),
      frameCss: abs("h5p-player/styles/h5p.css"),
      frame: true,
      copyright: true,
      export: false,
      embed: false,
      icon: false,
      fullScreen: true
    };
    new HS.H5P(el, opts).then(function () {
      var l = el.querySelector(".h5p-loading");
      if (l) l.remove();
    }).catch(function (e) {
      console.error(e);
      el.innerHTML = '<div class="h5p-loading">Diese Übung konnte nicht geladen werden.</div>';
    });
  }

  var embeds = document.querySelectorAll(".h5p-embed");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.unobserve(en.target); loadH5P(en.target); }
      });
    }, { rootMargin: "300px 0px" });
    embeds.forEach(function (el) { io.observe(el); });
  } else {
    embeds.forEach(loadH5P);
  }

  // ---------- Kachel-Dialoge
  document.querySelectorAll("[data-dialog]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var d = document.getElementById(btn.dataset.dialog);
      if (!d) return;
      if (d.showModal) d.showModal(); else d.setAttribute("open", "");
      d.querySelectorAll(".h5p-embed").forEach(loadH5P);
    });
  });
  document.querySelectorAll("dialog.tile-dialog").forEach(function (d) {
    d.querySelector(".dlg-close").addEventListener("click", function () { d.close ? d.close() : d.removeAttribute("open"); });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });

  // ---------- Glossar-Suche
  var gs = document.querySelector(".g-search");
  if (gs) {
    gs.addEventListener("input", function () {
      var q = gs.value.trim().toLowerCase();
      document.querySelectorAll(".g-entry").forEach(function (e) {
        var hit = !q || e.textContent.toLowerCase().indexOf(q) >= 0;
        e.style.display = hit ? "" : "none";
        if (q && hit && e.querySelector("summary").textContent.toLowerCase().indexOf(q) >= 0) e.open = true;
      });
      document.querySelectorAll(".g-letter").forEach(function (h) { h.style.display = q ? "none" : ""; });
    });
  }

  // ---------- Karussell: einfache Pfeile
  document.querySelectorAll(".carousel").forEach(function (c) {
    var wrap = document.createElement("div");
    wrap.className = "carousel-ctrl";
    wrap.innerHTML = '<button type="button" aria-label="Zurück">‹</button><button type="button" aria-label="Weiter">›</button>';
    c.after(wrap);
    var b = wrap.querySelectorAll("button");
    b[0].onclick = function () { c.scrollBy({ left: -c.clientWidth, behavior: "smooth" }); };
    b[1].onclick = function () { c.scrollBy({ left: c.clientWidth, behavior: "smooth" }); };
  });
})();
