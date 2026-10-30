(function () {
  "use strict";
  var D = window.QUIZDATA;
  if (!D) return;

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function stripP(s) { return (s || "").replace(/^\s*<p>([\s\S]*?)<\/p>\s*$/, "$1"); }

  function pickQuestions(quiz) {
    var used = {}, out = [];
    quiz.slots.forEach(function (s) {
      var q = null;
      if (s.fixed) q = D.questions[s.fixed];
      else {
        var pool = Object.keys(D.questions).map(function (k) { return D.questions[k]; })
          .filter(function (x) { return s.cats.indexOf(x.cat) >= 0 && !used[x.id]; });
        if (!pool.length) pool = Object.keys(D.questions).map(function (k) { return D.questions[k]; })
          .filter(function (x) { return s.cats.indexOf(x.cat) >= 0; });
        q = pool[Math.floor(Math.random() * pool.length)];
      }
      if (q && !used[q.id]) { used[q.id] = 1; out.push(q); }
    });
    return out;
  }

  // ======================================================= Fragetypen
  // jede Funktion liefert {el, grade():0..1, review()}
  var T = {};

  T.choice = function (q) {
    var multi = !q.single;
    var answers = q.shuffle ? shuffle(q.answers) : q.answers.slice();
    var name = "q" + q.id + "_" + Math.random().toString(36).slice(2, 7);
    var el = h("div", { class: "q-answers" });
    if (multi) el.appendChild(h("p", { class: "q-hint" }, "Wähle eine oder mehrere Antworten:"));
    var inputs = answers.map(function (a, i) {
      var lab = h("label", { class: "q-opt" });
      var inp = h("input", { type: multi ? "checkbox" : "radio", name: name, value: i });
      lab.appendChild(inp);
      lab.appendChild(h("span", null, stripP(a.html)));
      el.appendChild(lab);
      return inp;
    });
    function chosen() { return answers.filter(function (a, i) { return inputs[i].checked; }); }
    return {
      el: el,
      answered: function () { return chosen().length > 0; },
      grade: function () {
        var c = chosen();
        if (q.type === "multichoiceset") {
          var ok = answers.every(function (a, i) { return (a.fraction > 0) === inputs[i].checked; });
          return ok ? 1 : 0;
        }
        var s = c.reduce(function (t, a) { return t + a.fraction; }, 0);
        return Math.max(0, Math.min(1, s));
      },
      review: function () {
        inputs.forEach(function (inp, i) {
          inp.disabled = true;
          var lab = inp.parentNode, a = answers[i];
          if (a.fraction > 0) lab.classList.add("is-correct");
          else if (inp.checked) lab.classList.add("is-wrong");
          if (inp.checked && a.feedback && a.feedback.replace(/<[^>]+>/g, "").trim())
            lab.appendChild(h("div", { class: "q-fb" }, a.feedback));
        });
      }
    };
  };

  T.match = function (q) {
    var pairs = q.pairs.filter(function (p) { return p.q.replace(/<[^>]+>/g, "").trim(); });
    var opts = shuffle(Array.from(new Set(q.pairs.map(function (p) { return p.a; }))));
    var el = h("div", { class: "q-match" });
    var sels = shuffle(pairs).map(function (p) {
      var row = h("div", { class: "q-row" });
      row.appendChild(h("div", { class: "q-row-text" }, stripP(p.q)));
      var s = h("select");
      s.appendChild(h("option", { value: "" }, "Auswählen …"));
      opts.forEach(function (o) { var op = h("option", { value: o }); op.textContent = o; s.appendChild(op); });
      row.appendChild(s);
      el.appendChild(row);
      return { s: s, p: p, row: row };
    });
    return {
      el: el,
      answered: function () { return sels.some(function (x) { return x.s.value; }); },
      grade: function () { return sels.filter(function (x) { return x.s.value === x.p.a; }).length / sels.length; },
      review: function () {
        sels.forEach(function (x) {
          x.s.disabled = true;
          var ok = x.s.value === x.p.a;
          x.row.classList.add(ok ? "is-correct" : "is-wrong");
          if (!ok) x.row.appendChild(h("div", { class: "q-fb" }, "Richtig wäre: <strong>" + esc(x.p.a) + "</strong>"));
        });
      }
    };
  };

  T.gapselect = function (q) {
    var el = h("div", { class: "q-gap" });
    var gaps = [];
    el.innerHTML = q.text.replace(/\[\[(\d+)\]\]/g, function (m, n) {
      gaps.push(+n);
      return '<span class="gap" data-n="' + n + '"></span>';
    });
    var sels = [];
    el.querySelectorAll(".gap").forEach(function (span) {
      var n = +span.dataset.n, correct = q.choices[n - 1];
      var group = q.choices.filter(function (c) { return c.group === correct.group; });
      var uniq = shuffle(Array.from(new Set(group.map(function (c) { return c.text; }))));
      var s = h("select");
      s.appendChild(h("option", { value: "" }, "…"));
      uniq.forEach(function (o) { var op = h("option", { value: o }); op.textContent = o; s.appendChild(op); });
      span.appendChild(s);
      sels.push({ s: s, ans: correct.text, span: span });
    });
    return {
      el: el, replacesText: true,
      answered: function () { return sels.some(function (x) { return x.s.value; }); },
      grade: function () { return sels.filter(function (x) { return x.s.value === x.ans; }).length / sels.length; },
      review: function () {
        sels.forEach(function (x) {
          x.s.disabled = true;
          var ok = x.s.value === x.ans;
          x.span.classList.add(ok ? "is-correct" : "is-wrong");
          if (!ok) x.span.appendChild(h("span", { class: "q-fb-inline" }, " → " + esc(x.ans)));
        });
      }
    };
  };

  T.ordering = function (q) {
    var el = h("div", { class: "q-order" });
    el.appendChild(h("p", { class: "q-hint" }, "Bringe die Schritte mit den Pfeilen in die richtige Reihenfolge:"));
    var list = h("ol", { class: "order-list" });
    el.appendChild(list);
    var order = shuffle(q.items);
    var touched = false;
    function draw(rev) {
      list.innerHTML = "";
      order.forEach(function (it, i) {
        var li = h("li");
        li.appendChild(h("span", { class: "order-text" }, esc(it)));
        if (rev) {
          li.classList.add(q.items[i] === it ? "is-correct" : "is-wrong");
        } else {
          var up = h("button", { type: "button", "aria-label": "nach oben", onclick: function () { move(i, -1); } }, "▲");
          var dn = h("button", { type: "button", "aria-label": "nach unten", onclick: function () { move(i, 1); } }, "▼");
          if (i === 0) up.disabled = true;
          if (i === order.length - 1) dn.disabled = true;
          var b = h("span", { class: "order-btns" }); b.appendChild(up); b.appendChild(dn); li.appendChild(b);
        }
        list.appendChild(li);
      });
    }
    function move(i, d) {
      var j = i + d; var t = order[i]; order[i] = order[j]; order[j] = t; touched = true; draw(false);
    }
    draw(false);
    return {
      el: el,
      answered: function () { return touched; },
      grade: function () { return order.filter(function (it, i) { return q.items[i] === it; }).length / order.length; },
      review: function () {
        draw(true);
        var ok = q.items.map(function (x, i) { return (i + 1) + ". " + esc(x); }).join("<br>");
        el.appendChild(h("div", { class: "q-fb" }, "<strong>Richtige Reihenfolge:</strong><br>" + ok));
      }
    };
  };

  // ----- gemeinsame Bühne für Drag&Drop auf Bildern (skaliert mit der Breite)
  function Stage(src, onReady) {
    var outer = h("div", { class: "dd-outer" });
    var stage = h("div", { class: "dd-stage" });
    var img = h("img", { src: src, alt: "", draggable: "false" });
    stage.appendChild(img);
    outer.appendChild(stage);
    var api = { outer: outer, stage: stage, img: img, scale: 1, w: 0, h: 0 };
    function fit() {
      if (!api.w) return;
      var avail = outer.clientWidth || api.w;
      api.scale = Math.min(1, avail / api.w);
      stage.style.transform = "scale(" + api.scale + ")";
      outer.style.height = (api.h * api.scale) + "px";
    }
    img.addEventListener("load", function () {
      api.w = img.naturalWidth; api.h = img.naturalHeight;
      stage.style.width = api.w + "px"; stage.style.height = api.h + "px";
      fit(); onReady && onReady(api);
    });
    window.addEventListener("resize", fit);
    api.fit = fit;
    return api;
  }

  function chip(drag) {
    var c = h("button", { type: "button", class: "dd-chip", draggable: "true" });
    if (drag.img) c.appendChild(h("img", { src: drag.img, alt: drag.label || "", draggable: "false" }));
    else c.textContent = drag.label;
    c.dataset.no = drag.no;
    return c;
  }

  T.ddimageortext = function (q) {
    var el = h("div", { class: "q-dd" });
    var selected = null;
    var placed = {};
    var drags = {}; q.drags.forEach(function (d) { drags[d.no] = d; });
    var pool = h("div", { class: "dd-pool" });
    var zones = [];
    var st = Stage(q.bg, function () { sizeZones(); });
    el.appendChild(h("p", { class: "q-hint" }, "Tippe ein Kärtchen an und dann das passende Feld im Bild (oder ziehe es mit der Maus)."));
    el.appendChild(st.outer);
    el.appendChild(pool);

    var chips = {};
    shuffle(q.drags).forEach(function (d) {
      var c = chip(d);
      chips[d.no] = c;
      c.addEventListener("click", function () { select(d.no); });
      c.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", d.no); select(d.no); });
      pool.appendChild(c);
    });
    q.drops.forEach(function (dp) {
      var z = h("div", { class: "dd-zone", tabindex: "0" });
      z.style.left = dp.x + "px"; z.style.top = dp.y + "px";
      z.dataset.group = (drags[dp.choice] || {}).group || "1";
      z.addEventListener("click", function () { drop(dp.no); });
      z.addEventListener("keydown", function (e) { if (e.key === "Enter") drop(dp.no); });
      z.addEventListener("dragover", function (e) { e.preventDefault(); });
      z.addEventListener("drop", function (e) { e.preventDefault(); selected = +e.dataTransfer.getData("text/plain"); drop(dp.no); });
      st.stage.appendChild(z);
      zones[dp.no] = z;
    });
    function sizeZones() {
      // Feldgröße = größtes Kärtchen der Gruppe (wie in Moodle)
      var size = {};
      q.drags.forEach(function (d) {
        var c = chips[d.no]; var g = d.group;
        size[g] = size[g] || { w: 0, h: 0 };
        size[g].w = Math.max(size[g].w, c.offsetWidth); size[g].h = Math.max(size[g].h, c.offsetHeight);
      });
      zones.forEach(function (z) {
        if (!z) return;
        var s = size[z.dataset.group] || { w: 80, h: 30 };
        z.style.width = s.w + "px"; z.style.height = s.h + "px";
      });
    }
    function select(no) {
      selected = no;
      Object.keys(chips).forEach(function (k) { chips[k].classList.toggle("sel", +k === no); });
    }
    function drop(zno) {
      var z = zones[zno];
      if (placed[zno] != null && selected == null) { // zurücklegen
        var back = placed[zno]; delete placed[zno]; z.innerHTML = ""; z.classList.remove("filled");
        if (!drags[back].infinite) chips[back].hidden = false;
        return;
      }
      if (selected == null) return;
      var d = drags[selected];
      if (String(d.group) !== z.dataset.group) return;
      if (placed[zno] != null && !drags[placed[zno]].infinite) chips[placed[zno]].hidden = false;
      // ein Kärtchen (nicht unendlich) nur einmal
      if (!d.infinite) Object.keys(placed).forEach(function (k) {
        if (placed[k] === selected) { delete placed[k]; zones[k].innerHTML = ""; zones[k].classList.remove("filled"); }
      });
      placed[zno] = selected;
      z.innerHTML = ""; z.appendChild(chip(d)).tabIndex = -1; z.classList.add("filled");
      if (!d.infinite) chips[selected].hidden = true;
      select(null);
    }
    return {
      el: el,
      answered: function () { return Object.keys(placed).length > 0; },
      grade: function () {
        return q.drops.filter(function (dp) { return placed[dp.no] === dp.choice; }).length / q.drops.length;
      },
      review: function () {
        pool.hidden = true;
        q.drops.forEach(function (dp) {
          var z = zones[dp.no], ok = placed[dp.no] === dp.choice;
          z.classList.add(ok ? "is-correct" : "is-wrong");
          if (!ok) { z.innerHTML = ""; var c = chip(drags[dp.choice]); c.classList.add("solution"); z.appendChild(c); z.title = "Richtige Lösung"; }
        });
        el.appendChild(h("div", { class: "q-fb" }, "Grün = richtig gelegt. Rot markierte Felder zeigen die richtige Lösung."));
      },
      fit: function () { st.fit(); sizeZones(); }
    };
  };

  function inShape(dp, x, y) {
    var parts = dp.coords.split(";");
    if (dp.shape === "circle") {
      var c = parts[0].split(",").map(Number), r = +parts[1];
      return (x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) <= r * r * 1.2;
    }
    if (dp.shape === "rectangle") {
      var p = parts[0].split(",").map(Number), s = parts[1].split(",").map(Number);
      return x >= p[0] && x <= p[0] + s[0] && y >= p[1] && y <= p[1] + s[1];
    }
    var pts = parts.map(function (t) { return t.split(",").map(Number); }), inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  T.ddmarker = function (q) {
    var el = h("div", { class: "q-dd" });
    var selected = null, marks = [];
    var drags = {}; q.drags.forEach(function (d) { drags[d.no] = d; });
    var st = Stage(q.bg);
    var pool = h("div", { class: "dd-pool" });
    el.appendChild(h("p", { class: "q-hint" }, "Tippe einen Begriff an und dann die passende Stelle im Bild. Einen gesetzten Marker kannst du antippen, um ihn wieder zu entfernen."));
    el.appendChild(st.outer);
    el.appendChild(pool);
    var chips = {};
    shuffle(q.drags).forEach(function (d) {
      var c = chip(d); chips[d.no] = c;
      c.addEventListener("click", function () { selected = d.no; Object.keys(chips).forEach(function (k) { chips[k].classList.toggle("sel", +k === d.no); }); });
      pool.appendChild(c);
    });
    function used(no) { return marks.filter(function (m) { return m.no === no; }).length; }
    st.stage.addEventListener("click", function (e) {
      if (selected == null || e.target.closest(".dd-marker")) return;
      var r = st.stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / st.scale, y = (e.clientY - r.top) / st.scale;
      var d = drags[selected];
      if (!d.infinite && used(d.no) >= d.count) {
        var old = marks.filter(function (m) { return m.no === d.no; })[0];
        old.el.remove(); marks.splice(marks.indexOf(old), 1);
      }
      var mk = h("button", { type: "button", class: "dd-marker" });
      mk.textContent = d.label; mk.style.left = x + "px"; mk.style.top = y + "px";
      var m = { no: d.no, x: x, y: y, el: mk };
      mk.addEventListener("click", function (ev) { ev.stopPropagation(); if (mk.disabled) return; mk.remove(); marks.splice(marks.indexOf(m), 1); });
      st.stage.appendChild(mk); marks.push(m);
    });
    return {
      el: el,
      answered: function () { return marks.length > 0; },
      grade: function () {
        var hit = q.drops.filter(function (dp) {
          return marks.some(function (m) { return m.no === dp.choice && inShape(dp, m.x, m.y); });
        }).length;
        var extra = Math.max(0, marks.length - q.drops.length);
        return Math.max(0, (hit - extra) / q.drops.length);
      },
      review: function () {
        pool.hidden = true;
        marks.forEach(function (m) {
          m.el.disabled = true;
          var ok = q.drops.some(function (dp) { return dp.choice === m.no && inShape(dp, m.x, m.y); });
          m.el.classList.add(ok ? "is-correct" : "is-wrong");
        });
        q.drops.forEach(function (dp) {
          var parts = dp.coords.split(";"), x, y;
          if (dp.shape === "circle") { var c = parts[0].split(","); x = +c[0]; y = +c[1]; }
          else if (dp.shape === "rectangle") { var p = parts[0].split(","), s = parts[1].split(","); x = +p[0] + s[0] / 2; y = +p[1] + s[1] / 2; }
          else { var pts = parts.map(function (t) { return t.split(",").map(Number); }); x = pts.reduce(function (a, b) { return a + b[0]; }, 0) / pts.length; y = pts.reduce(function (a, b) { return a + b[1]; }, 0) / pts.length; }
          var sol = h("span", { class: "dd-solution" }); sol.textContent = drags[dp.choice].label;
          sol.style.left = x + "px"; sol.style.top = y + "px";
          st.stage.appendChild(sol);
        });
        el.appendChild(h("div", { class: "q-fb" }, "Gestrichelt: die richtigen Positionen. Grün = richtig gesetzt, rot = falsch."));
      },
      fit: function () { st.fit(); }
    };
  };

  function build(q) {
    if (q.type === "multichoice" || q.type === "truefalse" || q.type === "multichoiceset") return T.choice(q);
    return T[q.type](q);
  }

  // ======================================================= Ablauf
  document.querySelectorAll(".quiz-app").forEach(function (app) {
    var key = app.dataset.quiz, quiz = D.quizzes[key];
    var isFinal = key === "abschluss";

    function start() {
      var qs = pickQuestions(quiz);
      var items = qs.map(function (q) {
        var w = build(q);
        var card = h("div", { class: "q-card" });
        card.appendChild(h("div", { class: "q-meta" }, ""));
        if (!w.replacesText) card.appendChild(h("div", { class: "q-text" }, q.text));
        card.appendChild(w.el);
        return { q: q, w: w, card: card };
      });
      var cur = 0;
      app.innerHTML = "";
      var dots = h("div", { class: "q-dots" });
      var holder = h("div", { class: "q-holder" });
      var nav = h("div", { class: "q-nav" });
      var prev = h("button", { type: "button", class: "btn ghost" }, "← Zurück");
      var next = h("button", { type: "button", class: "btn" }, "Weiter →");
      var submit = h("button", { type: "button", class: "btn primary" }, "Test abgeben");
      nav.appendChild(prev); nav.appendChild(next); nav.appendChild(submit);
      app.appendChild(dots); app.appendChild(holder); app.appendChild(nav);
      items.forEach(function (it, i) {
        it.card.querySelector(".q-meta").textContent = "Frage " + (i + 1) + " von " + items.length;
        var d = h("button", { type: "button", class: "dot", "aria-label": "Frage " + (i + 1) }, String(i + 1));
        d.onclick = function () { show(i); };
        dots.appendChild(d); it.dot = d;
      });
      function show(i) {
        cur = i;
        holder.innerHTML = ""; holder.appendChild(items[i].card);
        if (items[i].w.fit) setTimeout(items[i].w.fit, 0);
        prev.disabled = i === 0;
        next.hidden = i === items.length - 1;
        items.forEach(function (it, k) {
          it.dot.classList.toggle("cur", k === i);
          it.dot.classList.toggle("done", !!it.w.answered());
        });
        app.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      prev.onclick = function () { show(cur - 1); };
      next.onclick = function () { show(cur + 1); };
      submit.onclick = function () {
        var open = items.filter(function (it) { return !it.w.answered(); }).length;
        var msg = open ? "Du hast " + open + " Frage(n) noch nicht beantwortet. Trotzdem abgeben?" : null;
        if (msg) {
          if (submit.dataset.confirm !== "1") {
            submit.dataset.confirm = "1"; submit.textContent = "Wirklich abgeben?";
            var warn = app.querySelector(".q-warn") || app.appendChild(h("p", { class: "q-warn" }));
            warn.textContent = msg;
            return;
          }
        }
        finish(items);
      };
      show(0);
    }

    function finish(items) {
      var total = 0, got = 0;
      items.forEach(function (it) {
        var f = it.w.grade(); it.f = f;
        total += it.q.mark; got += it.q.mark * f;
        it.w.review();
        it.card.classList.add(f >= 0.999 ? "res-ok" : f > 0 ? "res-part" : "res-no");
        var badge = f >= 0.999 ? "✔ richtig" : f > 0 ? "◐ teilweise richtig" : "✘ falsch";
        it.card.querySelector(".q-meta").innerHTML += ' · <strong>' + badge + "</strong>";
        if (it.q.general && it.q.general.replace(/<[^>]+>/g, "").trim()) it.card.appendChild(h("div", { class: "q-fb" }, it.q.general));
      });
      var pct = Math.round(got / total * 100);
      var pts = (Math.round(got * 10) / 10).toString().replace(".", ",");
      app.innerHTML = "";
      var res = h("div", { class: "q-result" });
      var praise = pct >= 90 ? "Hervorragend!" : pct >= 70 ? "Gut gemacht!" : pct >= 50 ? "Ordentlich – da geht noch was." : "Übe die Kapitel noch einmal und versuch es dann erneut.";
      res.innerHTML = '<div class="score-ring" style="--p:' + pct + '"><span>' + pct + ' %</span></div>' +
        "<div><h2>" + praise + "</h2><p>Du hast <strong>" + pts + " von " + total + " Punkten</strong> erreicht.</p></div>";
      app.appendChild(res);
      if (isFinal) {
        var cert = h("div", { class: "q-cert" });
        var today = new Date().toLocaleDateString("de-DE");
        cert.innerHTML = '<label>Dein Name: <input type="text" class="cert-name" placeholder="Vor- und Nachname"></label>' +
          '<button type="button" class="btn primary">Ergebnis drucken</button>' +
          '<p class="print-only cert-line">Abschlusstest „Digitaler Atlasführerschein“ · <span class="cn"></span> · ' + pts + " von " + total + " Punkten (" + pct + " %) · " + today + "</p>" +
          '<p class="small">Zeige dein Ergebnis deiner Lehrkraft – sie stellt dir dann deinen Atlasführerschein aus.</p>';
        cert.querySelector("button").onclick = function () {
          cert.querySelector(".cn").textContent = cert.querySelector(".cert-name").value || "________________";
          window.print();
        };
        app.appendChild(cert);
      }
      var again = h("button", { type: "button", class: "btn" }, "Neuen Durchgang starten");
      again.onclick = intro;
      app.appendChild(h("h3", { class: "review-h" }, "Deine Antworten im Überblick"));
      items.forEach(function (it) { app.appendChild(it.card); if (it.w.fit) setTimeout(it.w.fit, 0); });
      app.appendChild(again);
      app.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function intro() {
      app.innerHTML = "";
      var box = h("div", { class: "q-start" });
      box.innerHTML = "<h2>" + esc(quiz.title) + "</h2><p>" + quiz.slots.length +
        " Fragen, zufällig aus allen Kapiteln ausgewählt. Am Ende siehst du deine Punkte und die richtigen Lösungen.</p>";
      var b = h("button", { type: "button", class: "btn primary" }, "Test starten");
      b.onclick = start;
      box.appendChild(b);
      app.appendChild(box);
    }
    intro();
  });
})();
