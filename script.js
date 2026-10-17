// Gemeinsame Bausteine für alle Seiten: Navigation, Fußzeile, Quiz, Lernkarten,
// Zuordnen-Spiel, Binär-Rechner und der Passwortschutz für Klassengeschehen.

const PAGES = [
  { href: "index.html", label: "Start" },
  { href: "hauswirtschaft.html", label: "Hauswirtschaft" },
  { href: "erdkunde.html", label: "Erdkunde" },
  { href: "informatik.html", label: "Informatik" },
  { href: "klassengeschehen.html", label: "Klassengeschehen 🔒" },
];

function renderChrome() {
  const here = location.pathname.split("/").pop() || "index.html";
  const nav = document.getElementById("nav");
  if (nav) {
    nav.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html">☀︎ Frau KIbach</a>
        <ul>${PAGES.map(
          (p) => `<li><a class="link${p.href === here ? " active" : ""}" href="${p.href}">${p.label}</a></li>`
        ).join("")}</ul>
      </div>`;
  }
  const foot = document.getElementById("footer");
  if (foot) {
    foot.innerHTML = `
      <span class="script">Viel Freude beim Lernen!</span>
      Interaktive Lerninhalte von Frau KIbach · ${new Date().getFullYear()}`;
  }
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Quiz: questions = [{ q, options: [...], answer: index }]
function mountQuiz(el, questions) {
  let order, idx, score;

  function start() {
    order = shuffle(questions);
    idx = 0;
    score = 0;
    show();
  }

  function show() {
    if (idx >= order.length) return finish();
    const item = order[idx];
    const opts = shuffle(item.options.map((text, i) => ({ text, right: i === item.answer })));
    el.innerHTML = `
      <div class="quiz-progress">Frage ${idx + 1} von ${order.length}</div>
      <div class="quiz-q">${item.q}</div>
      <div class="options">${opts.map((o, i) => `<button class="option" data-i="${i}">${o.text}</button>`).join("")}</div>
      <div class="quiz-foot">
        <span class="feedback" aria-live="polite"></span>
        <button class="btn hidden next">Weiter</button>
      </div>`;
    const fb = el.querySelector(".feedback");
    const next = el.querySelector(".next");
    el.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const chosen = opts[btn.dataset.i];
        el.querySelectorAll(".option").forEach((b) => {
          b.disabled = true;
          if (opts[b.dataset.i].right) b.classList.add("right");
        });
        if (chosen.right) {
          score++;
          fb.textContent = "Richtig! 🌿";
        } else {
          btn.classList.add("wrong");
          fb.textContent = "Leider falsch.";
        }
        if (item.explain) fb.textContent += " " + item.explain;
        next.classList.remove("hidden");
        next.focus();
      });
    });
    next.addEventListener("click", () => {
      idx++;
      show();
    });
  }

  function finish() {
    const ratio = score / order.length;
    const msg = ratio === 1 ? "Perfekt, alles richtig!" : ratio >= 0.6 ? "Gut gemacht!" : "Übung macht den Meister!";
    el.innerHTML = `
      <div class="result">
        <div class="big">${score} / ${order.length}</div>
        <p>${msg}</p>
        <button class="btn again">Noch einmal</button>
      </div>`;
    el.querySelector(".again").addEventListener("click", start);
  }

  start();
}

// Lernkarten: cards = [{ front, back }]
function mountFlashcards(el, cards) {
  el.innerHTML = cards
    .map(
      (c) => `
      <button class="flip" aria-label="Karte umdrehen">
        <div class="flip-inner">
          <div class="flip-face flip-front">${c.front}</div>
          <div class="flip-face flip-back">${c.back}</div>
        </div>
      </button>`
    )
    .join("");
  el.querySelectorAll(".flip").forEach((f) => f.addEventListener("click", () => f.classList.toggle("turned")));
}

// Zuordnen: erst einen Begriff antippen, dann die passende Kiste.
// items = [{ text, bin }], bins = ["Name", ...]
function mountSorter(el, items, bins) {
  function start() {
    let selected = null;
    let left = items.length;
    el.innerHTML = `
      <div class="sort-items">${shuffle(items).map((it) => `<button class="chip" data-bin="${it.bin}">${it.text}</button>`).join("")}</div>
      <div class="bins">${bins.map((b) => `<button class="bin" data-bin="${b}"><strong>${b}</strong><span class="slot"></span></button>`).join("")}</div>
      <div class="quiz-foot"><span class="feedback" aria-live="polite">Tippe zuerst einen Begriff an, dann die passende Kiste.</span></div>`;
    const fb = el.querySelector(".feedback");
    el.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        if (chip.classList.contains("done-right")) return;
        el.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
        chip.classList.add("selected");
        selected = chip;
      })
    );
    el.querySelectorAll(".bin").forEach((bin) =>
      bin.addEventListener("click", () => {
        if (!selected) {
          fb.textContent = "Wähle zuerst einen Begriff aus.";
          return;
        }
        if (selected.dataset.bin === bin.dataset.bin) {
          bin.querySelector(".slot").insertAdjacentHTML("beforeend", `<span class="placed">${selected.textContent}</span>`);
          selected.remove();
          selected = null;
          left--;
          fb.textContent = left ? "Richtig! 🌿" : "Super, alles richtig zugeordnet!";
          if (!left) {
            el.querySelector(".quiz-foot").insertAdjacentHTML("beforeend", `<button class="btn again">Noch einmal</button>`);
            el.querySelector(".again").addEventListener("click", start);
          }
        } else {
          fb.textContent = `„${selected.textContent}“ gehört nicht zu „${bin.dataset.bin}“. Versuch es nochmal!`;
        }
      })
    );
  }
  start();
}

// Binär-Rechner: 8 Schalter, Summe wird live angezeigt, dazu eine Zielzahl-Aufgabe.
function mountBinary(el) {
  const weights = [128, 64, 32, 16, 8, 4, 2, 1];
  const state = weights.map(() => 0);
  let target = newTarget();

  function newTarget() {
    return 1 + Math.floor(Math.random() * 255);
  }

  el.innerHTML = `
    <p class="bin-result">Aufgabe: Stelle die Zahl <strong class="target"></strong> dar.</p>
    <div class="bits">${weights.map((w, i) => `<button class="bit" data-i="${i}"><span class="val">0</span><span class="w">${w}</span></button>`).join("")}</div>
    <p class="bin-result">Deine Zahl: <strong class="sum">0</strong></p>
    <div class="quiz-foot"><span class="feedback" aria-live="polite"></span><button class="btn ghost new">Neue Aufgabe</button></div>`;

  const sumEl = el.querySelector(".sum");
  const fb = el.querySelector(".feedback");
  const targetEl = el.querySelector(".target");

  function update() {
    const sum = state.reduce((s, b, i) => s + b * weights[i], 0);
    sumEl.textContent = sum;
    targetEl.textContent = target;
    fb.textContent = sum === target ? `Richtig! ${target} = ${state.join("")} im Binärsystem 🎉` : "";
  }

  el.querySelectorAll(".bit").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = btn.dataset.i;
      state[i] = 1 - state[i];
      btn.classList.toggle("on", state[i] === 1);
      btn.querySelector(".val").textContent = state[i];
      update();
    })
  );
  el.querySelector(".new").addEventListener("click", () => {
    target = newTarget();
    state.fill(0);
    el.querySelectorAll(".bit").forEach((b) => {
      b.classList.remove("on");
      b.querySelector(".val").textContent = "0";
    });
    update();
  });
  update();
}

// Einfacher Passwortschutz (nur im Browser, kein echter Schutz).
// Gespeichert ist nur der SHA-256-Fingerabdruck des Passworts.
const KLASSE_HASH = "dedf0ddf0a911031fda9d3921019a8c5271ccd96333430464aa9e9cbda8ec808";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mountGate() {
  const form = document.getElementById("gate");
  const content = document.getElementById("protected");
  if (!form || !content) return;
  const unlock = () => {
    form.classList.add("hidden");
    content.classList.remove("hidden");
  };
  try {
    if (sessionStorage.getItem("klasse-ok") === "1") return unlock();
  } catch (e) {}
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = form.querySelector("input");
    if ((await sha256(input.value.trim())) === KLASSE_HASH) {
      try { sessionStorage.setItem("klasse-ok", "1"); } catch (e) {}
      unlock();
    } else {
      form.querySelector(".err").textContent = "Das Passwort stimmt leider nicht.";
      input.select();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderChrome();
  mountGate();
});
