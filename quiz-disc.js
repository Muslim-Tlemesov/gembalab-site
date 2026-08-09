// Тест DISC — поведенческий стиль (D/I/S/C). Добавлен по тому же принципу,
// что и тесты Маслоу и Белбина (см. quiz-maslow.js, quiz-belbin.js):
// прохождение и отчёт внутри панели "Список тестов и анкет", результат
// сохраняется в этом браузере (localStorage) и параллельно отправляется в
// общую базу на сервере (тот же Cloudflare Worker), чтобы владелец сайта
// видел результаты сотрудников в админке (admin.html).
//
// Формат теста — классический "форс-чойс" DISC (см. фото бумажного
// опросника): 28 блоков по 4 слова, в каждом блоке нужно отметить, какое
// слово подходит "больше всего", а какое — "меньше всего" (ровно по одному
// выбору на блок, не может быть одно и то же слово в обоих). У каждого
// слова в паспорте опросника прямо указана буква (D, I, S или C), к которой
// оно относится, — вариантов на смысловую интерпретацию тут нет, буквы
// перенесены как есть с бумажного бланка.
//
// Подсчёт: по каждой букве — количество раз, когда её слово выбрали
// "больше всего" (М), минус количество раз, когда выбрали "меньше всего"
// (Л). Итог — число от -28 до +28 по каждой из 4 букв (D, I, S, C), как на
// графике в примере итогового отчёта. Точная шкала/формула официального
// платного теста DISC (с дробными баллами вроде "-8.5") нигде не
// опубликована как открытый ключ, поэтому здесь используется прозрачный и
// понятный вариант "число больше минус число меньше" — расстановка сильных
// и слабых сторон получается той же, просто без проприetарного
// сглаживания.

const DISC_AI_WORKER_URL = "https://gembalab-maslow-report.gembalab.workers.dev";

const DISC_LETTER_ORDER = ["d", "i", "s", "c"];

const DISC_LETTER_LABELS = {
  d: "D — Доминирование",
  i: "I — Влияние",
  s: "S — Постоянство",
  c: "C — Соответствие",
};

const DISC_LETTER_SHORT = { d: "D", i: "I", s: "S", c: "C" };

// Короткое описание "от второго лица" — запасной текст, пока не запрошен
// персональный ИИ-отчёт (по аналогии с MASLOW_EXPLANATIONS/BELBIN_ROLE_TEMPLATES).
const DISC_LETTER_TEMPLATES = {
  d: "Вы уверены в себе, энергичны и ориентированы на результат — легко берёте на себя ответственность и быстро принимаете решения. Комфортно чувствуете себя в сложных, быстро меняющихся условиях, любите вызовы и соревновательность. Обратная сторона — нетерпеливость и резкость в общении: полезно чаще притормаживать и вовлекать людей, прежде чем действовать.",
  i: "Вы общительны, оптимистичны и легко заряжаете окружающих энтузиазмом. Вам важны внимание и признание, вы хорошо убеждаете и умеете находиться среди людей. Обратная сторона — импульсивность и сложности с самоорганизацией: полезно вести записи и перепроверять договорённости, чтобы ничего не терялось.",
  s: "Вы надёжны, спокойны и внимательны к людям — цените порядок, стабильность и предсказуемость. Хорошо чувствуете настроение окружающих и редко создаёте конфликты. Обратная сторона — сложности с переменами и неумение говорить «нет»: полезно чаще заявлять о своих потребностях и не бояться перемен, которые пойдут на пользу.",
  c: "Вы точны, методичны и ориентированы на качество — любите разбираться в деталях и не терпите приблизительности. Вам важно быть правым и не ошибаться, поэтому вы тщательно всё проверяете. Обратная сторона — излишняя критичность и медлительность в решениях: полезно иногда действовать быстрее, не дожидаясь идеальных условий.",
};

// 28 блоков × 4 слова. У каждого слова — буква (letter), как она указана в
// бумажном бланке (D/I/S/C); сотруднику буквы не показываются.
const DISC_QUESTIONS = [
  { options: [
    { text: "восторженный, полный энтузиазма", letter: "i" },
    { text: "смелый, дерзкий", letter: "d" },
    { text: "дипломатичный", letter: "c" },
    { text: "удовлетворённый", letter: "s" },
  ] },
  { options: [
    { text: "осторожный, осмотрительный", letter: "c" },
    { text: "решительный", letter: "d" },
    { text: "убедительный", letter: "i" },
    { text: "добродушный", letter: "s" },
  ] },
  { options: [
    { text: "дружелюбный", letter: "i" },
    { text: "точный", letter: "c" },
    { text: "прямой, откровенный", letter: "d" },
    { text: "спокойный", letter: "s" },
  ] },
  { options: [
    { text: "разговорчивый", letter: "i" },
    { text: "сдержанный", letter: "c" },
    { text: "традиционный, консервативный", letter: "s" },
    { text: "исполненный решимости", letter: "d" },
  ] },
  { options: [
    { text: "любящий приключения, рискованный", letter: "d" },
    { text: "проницательный", letter: "c" },
    { text: "уживчивый, с лёгким характером", letter: "i" },
    { text: "умеренный", letter: "s" },
  ] },
  { options: [
    { text: "мягкий, кроткий", letter: "s" },
    { text: "убедительный", letter: "i" },
    { text: "скромный, незаметный", letter: "c" },
    { text: "оригинальный, самобытный", letter: "d" },
  ] },
  { options: [
    { text: "выразительный", letter: "i" },
    { text: "добросовестный, сознательный", letter: "c" },
    { text: "доминирующий", letter: "d" },
    { text: "чуткий, отзывчивый", letter: "s" },
  ] },
  { options: [
    { text: "уравновешенный", letter: "i" },
    { text: "наблюдательный, внимательный", letter: "c" },
    { text: "скромный", letter: "s" },
    { text: "нетерпеливый", letter: "d" },
  ] },
  { options: [
    { text: "тактичный", letter: "c" },
    { text: "приятный, милый", letter: "s" },
    { text: "притягивающий, привлекательный", letter: "i" },
    { text: "настойчивый", letter: "d" },
  ] },
  { options: [
    { text: "храбрый", letter: "d" },
    { text: "вдохновляющий", letter: "i" },
    { text: "послушный, покорный", letter: "s" },
    { text: "застенчивый, неуверенный", letter: "c" },
  ] },
  { options: [
    { text: "сдержанный, замкнутый", letter: "c" },
    { text: "обязательный", letter: "s" },
    { text: "решительный, волевой", letter: "d" },
    { text: "бодрый, неунывающий", letter: "i" },
  ] },
  { options: [
    { text: "побуждающий", letter: "i" },
    { text: "добрый", letter: "s" },
    { text: "проницательный", letter: "c" },
    { text: "независимый", letter: "d" },
  ] },
  { options: [
    { text: "соперничающий, конкурирующий", letter: "d" },
    { text: "внимательный, заботливый", letter: "s" },
    { text: "радостный, счастливый", letter: "i" },
    { text: "закрытый", letter: "c" },
  ] },
  { options: [
    { text: "внимательный к деталям", letter: "c" },
    { text: "послушный", letter: "s" },
    { text: "твёрдый", letter: "d" },
    { text: "игривый, весёлый", letter: "i" },
  ] },
  { options: [
    { text: "привлекательный", letter: "i" },
    { text: "углублённый в себя", letter: "c" },
    { text: "упорный, упрямый", letter: "d" },
    { text: "предсказуемый", letter: "s" },
  ] },
  { options: [
    { text: "логичный", letter: "c" },
    { text: "уверенный в себе", letter: "d" },
    { text: "верный, надёжный", letter: "s" },
    { text: "очаровательный, обаятельный", letter: "i" },
  ] },
  { options: [
    { text: "общительный, компанейский", letter: "i" },
    { text: "терпеливый", letter: "s" },
    { text: "полагающийся на себя", letter: "d" },
    { text: "тихий", letter: "c" },
  ] },
  { options: [
    { text: "старательный, усердный", letter: "s" },
    { text: "страстно стремящийся, нетерпеливый", letter: "d" },
    { text: "тщательный", letter: "c" },
    { text: "пылкий, горячий", letter: "i" },
  ] },
  { options: [
    { text: "агрессивный", letter: "d" },
    { text: "экстраверт", letter: "i" },
    { text: "благожелательный, дружелюбный", letter: "s" },
    { text: "робкий, пугливый", letter: "c" },
  ] },
  { options: [
    { text: "уверенный", letter: "i" },
    { text: "сочувствующий", letter: "s" },
    { text: "беспристрастный", letter: "c" },
    { text: "напористый, самоуверенный", letter: "d" },
  ] },
  { options: [
    { text: "дисциплинированный", letter: "c" },
    { text: "щедрый", letter: "s" },
    { text: "живой", letter: "i" },
    { text: "постоянный", letter: "d" },
  ] },
  { options: [
    { text: "импульсивный", letter: "i" },
    { text: "интроверт", letter: "c" },
    { text: "сильный, волевой", letter: "d" },
    { text: "покладистый, с лёгким характером", letter: "s" },
  ] },
  { options: [
    { text: "общительный", letter: "i" },
    { text: "утончённый, изысканный", letter: "c" },
    { text: "сильный, энергичный", letter: "d" },
    { text: "снисходительный, терпимый", letter: "s" },
  ] },
  { options: [
    { text: "обаятельный, чарующий", letter: "i" },
    { text: "довольный, удовлетворённый", letter: "s" },
    { text: "требовательный", letter: "d" },
    { text: "уступчивый", letter: "c" },
  ] },
  { options: [
    { text: "любящий спорить", letter: "d" },
    { text: "организованный", letter: "c" },
    { text: "сотрудничающий", letter: "s" },
    { text: "беззаботный, беспечный", letter: "i" },
  ] },
  { options: [
    { text: "весёлый, общительный", letter: "i" },
    { text: "точный", letter: "c" },
    { text: "прямой", letter: "d" },
    { text: "уравновешенный, невозмутимый", letter: "s" },
  ] },
  { options: [
    { text: "неугомонный", letter: "d" },
    { text: "приветливый", letter: "s" },
    { text: "привлекательный", letter: "i" },
    { text: "заботливый, внимательный", letter: "c" },
  ] },
  { options: [
    { text: "уважительный", letter: "c" },
    { text: "новатор, первопроходец", letter: "d" },
    { text: "оптимист", letter: "i" },
    { text: "услужливый", letter: "s" },
  ] },
];

// Ведущий тип — буква с наибольшим итоговым баллом, или две буквы, если
// у них точная ничья на первом месте.
function discTopLetters(totals) {
  const ranked = DISC_LETTER_ORDER.map((key) => ({ key, score: totals[key] || 0 })).sort((a, b) => b.score - a.score);
  let count = 1;
  if (ranked[1] && ranked[1].score === ranked[0].score) count = 2;
  return ranked.slice(0, count);
}

const DISC_STORAGE_KEY = "gembalab_disc_result_v1";

function saveDiscResult(totals, counts, aiData) {
  try {
    localStorage.setItem(
      DISC_STORAGE_KEY,
      JSON.stringify({ totals: totals, counts: counts, ai: aiData || null, savedAt: Date.now() })
    );
  } catch (e) {}
}

function loadDiscResult() {
  try {
    const raw = localStorage.getItem(DISC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearDiscResult() {
  try {
    localStorage.removeItem(DISC_STORAGE_KEY);
  } catch (e) {}
}

// Небольшой линейный график D-I-S-C (как в примере отчёта) — рисуется как
// инлайновый SVG, шкала зафиксирована от -30 до +30, чтобы графики разных
// сотрудников были сопоставимы друг с другом.
function discChartSvg(totals) {
  const W = 420;
  const H = 220;
  const padL = 40;
  const padR = 20;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const minV = -30;
  const maxV = 30;

  function yFor(v) {
    const clamped = Math.max(minV, Math.min(maxV, v));
    return padT + ((maxV - clamped) / (maxV - minV)) * plotH;
  }

  const gridVals = [-30, -20, -10, 0, 10, 20, 30];
  const gridLines = gridVals
    .map((v) => {
      const y = yFor(v);
      const strong = v === 0;
      return (
        '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (strong ? "#c7cbd3" : "#e4e6ea") + '" stroke-width="' + (strong ? 1.5 : 1) + '" />' +
        '<text x="' + (padL - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="10" fill="#6b7280" text-anchor="end">' + v + "</text>"
      );
    })
    .join("");

  const pts = DISC_LETTER_ORDER.map((key, i) => {
    const x = padL + i * (plotW / (DISC_LETTER_ORDER.length - 1));
    const y = yFor(totals[key] || 0);
    return { x, y, key };
  });

  const pathD = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

  const dots = pts
    .map((p) => {
      return (
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="#e9152b" />' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 10).toFixed(1) + '" font-size="12" font-weight="700" fill="#394155" text-anchor="middle">' + (totals[p.key] || 0) + "</text>" +
        '<text x="' + p.x.toFixed(1) + '" y="' + (H - padB + 20) + '" font-size="13" font-weight="700" fill="#394155" text-anchor="middle">' + DISC_LETTER_SHORT[p.key] + "</text>"
      );
    })
    .join("");

  return (
    '<svg viewBox="0 0 ' + W + " " + H + '" class="cabinet__disc-chart-svg" role="img" aria-label="График DISC">' +
    gridLines +
    '<path d="' + pathD + '" fill="none" stroke="#394155" stroke-width="2" />' +
    dots +
    "</svg>"
  );
}

function discTableHtml(counts, totals) {
  const rows = DISC_LETTER_ORDER.map((key) => {
    return (
      "<tr><td>" + DISC_LETTER_LABELS[key] + "</td><td>" + (counts.most[key] || 0) + "</td><td>" +
      (counts.least[key] || 0) + "</td><td><strong>" + (totals[key] || 0) + "</strong></td></tr>"
    );
  }).join("");
  return (
    '<table class="cabinet__disc-table"><thead><tr><th>Тип</th><th>Больше всего</th><th>Меньше всего</th><th>Итог</th></tr></thead><tbody>' +
    rows +
    "</tbody></table>"
  );
}

const DISC_TEXT_SECTIONS = [
  { key: "decoding", title: "Расшифровка" },
  { key: "behavior", title: "Поведение" },
  { key: "strengths", title: "Сильные стороны" },
  { key: "risks", title: "Риски" },
  { key: "advice", title: "Советы" },
  { key: "professions", title: "Профессии" },
  { key: "final_advice", title: "Финальный совет" },
];

function renderDiscTextSections(container, totals, aiData) {
  container.innerHTML = "";

  if (!aiData) {
    const top = discTopLetters(totals);
    const note = document.createElement("p");
    note.className = "cabinet__placeholder";
    note.style.marginBottom = "14px";
    note.innerHTML =
      "Ваш ведущий тип: <strong>" + top.map((t) => DISC_LETTER_LABELS[t.key]).join(", ") +
      "</strong>. Ниже — общее описание; нажмите «Сформировать отчёт», чтобы получить персональный разбор по вашим баллам.";
    container.appendChild(note);
    top.forEach((t) => {
      const item = document.createElement("div");
      item.className = "cabinet__result-item";
      const title = document.createElement("div");
      title.className = "cabinet__result-item-title";
      title.textContent = DISC_LETTER_LABELS[t.key] + " (" + t.score + ")";
      const text = document.createElement("p");
      text.className = "cabinet__result-item-text";
      text.textContent = DISC_LETTER_TEMPLATES[t.key];
      item.appendChild(title);
      item.appendChild(text);
      container.appendChild(item);
    });
    return;
  }

  DISC_TEXT_SECTIONS.forEach((s) => {
    const text = aiData[s.key];
    if (!text) return;
    const item = document.createElement("div");
    item.className = "cabinet__result-item cabinet__result-item--ai";
    const title = document.createElement("div");
    title.className = "cabinet__result-item-title";
    title.textContent = s.title;
    const p = document.createElement("p");
    p.className = "cabinet__result-item-text";
    p.textContent = text;
    item.appendChild(title);
    item.appendChild(p);
    container.appendChild(item);
  });
}

// Общая отрисовка отчёта (график + таблица баллов + текстовые разделы) —
// используется и на экране результатов внутри теста, и в разделе
// "Результаты" личного кабинета, и в админке.
function renderDiscReport(els, totals, counts, aiData) {
  els.chartEl.innerHTML = discChartSvg(totals);
  els.tableEl.innerHTML = discTableHtml(counts, totals);
  renderDiscTextSections(els.textEl, totals, aiData);
}

// Раздел "Результаты" личного кабинета — свой блок под блоками Маслоу и
// Белбина, читает сохранённый результат из localStorage.
(function () {
  const emptyEl = document.getElementById("discResultsEmpty");
  const filledEl = document.getElementById("discResultsFilled");
  if (!emptyEl || !filledEl) return;

  const dateEl = document.getElementById("discResultsDate");
  const clearBtn = document.getElementById("discResultsClear");
  const resultsEls = {
    chartEl: document.getElementById("discResultsChart"),
    tableEl: document.getElementById("discResultsTable"),
    textEl: document.getElementById("discResultsText"),
  };

  window.refreshDiscResultsPanel = function () {
    const saved = loadDiscResult();
    if (!saved || !saved.totals) {
      emptyEl.style.display = "";
      filledEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    filledEl.style.display = "";
    renderDiscReport(resultsEls, saved.totals, saved.counts, saved.ai);
    if (dateEl) {
      const d = saved.savedAt ? new Date(saved.savedAt) : null;
      dateEl.textContent = d
        ? "Сохранено: " + d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "";
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Удалить сохранённый результат теста DISC?")) return;
      clearDiscResult();
      window.refreshDiscResultsPanel();
    });
  }

  window.refreshDiscResultsPanel();
})();

(function () {
  const listView = document.getElementById("testsListView");
  const quiz = document.getElementById("quizDisc");
  if (!listView || !quiz) return;

  const progressEl = document.getElementById("quizDiscProgress");
  const questionTextEl = document.getElementById("quizDiscQuestionText");
  const optionsEl = document.getElementById("quizDiscOptions");
  const totalEl = document.getElementById("quizDiscTotal");
  const prevBtn = document.getElementById("quizDiscPrev");
  const nextBtn = document.getElementById("quizDiscNext");
  const backBtn = document.getElementById("quizDiscBack");
  const restartBtn = document.getElementById("quizDiscRestart");
  const bodyEl = document.getElementById("quizDiscBody");
  const navEl = quiz.querySelector(".cabinet__quiz-nav");
  const doneEl = document.getElementById("quizDiscDone");

  const chartEl = document.getElementById("quizDiscChart");
  const tableEl = document.getElementById("quizDiscTable");
  const textEl = document.getElementById("quizDiscText");
  const aiBtn = document.getElementById("quizDiscAiBtn");
  const aiStatusEl = document.getElementById("quizDiscAiStatus");
  const submitStatusEl = document.getElementById("quizDiscSubmitStatus");

  const startEl = document.getElementById("quizDiscStart");
  const nameInput = document.getElementById("quizDiscName");
  const deptInput = document.getElementById("quizDiscDept");
  const startErrorEl = document.getElementById("quizDiscStartError");

  // answers[i] — { most: индекс варианта | null, least: индекс варианта | null }
  const answers = DISC_QUESTIONS.map(() => ({ most: null, least: null }));
  let current = 0;
  let lastTotals = null;
  let lastCounts = null;
  let employeeName = "";
  let employeeDept = "";
  let lastSubmissionId = null;

  function isAnswered(i) {
    return answers[i].most !== null && answers[i].least !== null;
  }

  function renderProgress() {
    progressEl.innerHTML = "";
    DISC_QUESTIONS.forEach((_, i) => {
      const item = document.createElement("div");
      item.className = "cabinet__quiz-progress-item";
      if (isAnswered(i)) item.classList.add("cabinet__quiz-progress-item--answered");
      if (i === current) item.classList.add("cabinet__quiz-progress-item--active");
      item.textContent = i + 1;
      progressEl.appendChild(item);
    });
  }

  function renderTotal() {
    const done = isAnswered(current);
    totalEl.textContent = done
      ? "Выбор сделан ✓"
      : "Отметьте, что подходит вам больше всего и что — меньше всего.";
    totalEl.classList.toggle("cabinet__quiz-points-total--ok", done);
    nextBtn.disabled = !done;
  }

  function renderQuestion() {
    startEl.style.display = "none";
    progressEl.style.display = "";
    bodyEl.style.display = "";
    navEl.style.display = "";
    doneEl.classList.remove("cabinet__quiz-done--visible");

    questionTextEl.textContent = "Блок " + (current + 1) + " из " + DISC_QUESTIONS.length;
    optionsEl.innerHTML = "";

    const q = DISC_QUESTIONS[current];
    const rowRefs = [];

    function updateOptionStates() {
      const a = answers[current];
      rowRefs.forEach((ref, i) => {
        ref.mostBtn.classList.toggle("cabinet__quiz-disc-pick--active", a.most === i);
        ref.leastBtn.classList.toggle("cabinet__quiz-disc-pick--active", a.least === i);
        ref.mostBtn.disabled = a.least === i;
        ref.leastBtn.disabled = a.most === i;
      });
    }

    q.options.forEach((opt, i) => {
      const row = document.createElement("div");
      row.className = "cabinet__quiz-disc-row";

      const label = document.createElement("span");
      label.className = "cabinet__quiz-disc-label";
      label.textContent = opt.text;

      const picks = document.createElement("div");
      picks.className = "cabinet__quiz-disc-picks";

      const mostBtn = document.createElement("button");
      mostBtn.type = "button";
      mostBtn.className = "cabinet__quiz-disc-pick cabinet__quiz-disc-pick--most";
      mostBtn.textContent = "Больше всего";
      mostBtn.addEventListener("click", function () {
        answers[current].most = i;
        if (answers[current].least === i) answers[current].least = null;
        updateOptionStates();
        renderProgress();
        renderTotal();
      });

      const leastBtn = document.createElement("button");
      leastBtn.type = "button";
      leastBtn.className = "cabinet__quiz-disc-pick cabinet__quiz-disc-pick--least";
      leastBtn.textContent = "Меньше всего";
      leastBtn.addEventListener("click", function () {
        answers[current].least = i;
        if (answers[current].most === i) answers[current].most = null;
        updateOptionStates();
        renderProgress();
        renderTotal();
      });

      picks.appendChild(mostBtn);
      picks.appendChild(leastBtn);
      row.appendChild(label);
      row.appendChild(picks);
      optionsEl.appendChild(row);

      rowRefs.push({ mostBtn, leastBtn });
    });

    updateOptionStates();

    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === DISC_QUESTIONS.length - 1 ? "Завершить тест" : "Далее";

    renderTotal();
    renderProgress();
  }

  function computeScores() {
    const mostCount = { d: 0, i: 0, s: 0, c: 0 };
    const leastCount = { d: 0, i: 0, s: 0, c: 0 };
    DISC_QUESTIONS.forEach((q, qi) => {
      const a = answers[qi];
      if (a.most !== null) mostCount[q.options[a.most].letter]++;
      if (a.least !== null) leastCount[q.options[a.least].letter]++;
    });
    const totals = {};
    DISC_LETTER_ORDER.forEach((key) => (totals[key] = mostCount[key] - leastCount[key]));
    return { totals, counts: { most: mostCount, least: leastCount } };
  }

  function renderResults() {
    const { totals, counts } = computeScores();
    lastTotals = totals;
    lastCounts = counts;
    aiStatusEl.textContent = "";
    aiStatusEl.classList.remove("cabinet__result-ai-status--error");
    aiBtn.disabled = false;
    aiBtn.textContent = "Сформировать отчёт";

    renderDiscReport({ chartEl, tableEl, textEl }, totals, counts, null);

    saveDiscResult(totals, counts, null);
    if (window.refreshDiscResultsPanel) window.refreshDiscResultsPanel();
  }

  function showDone() {
    bodyEl.style.display = "none";
    navEl.style.display = "none";
    renderResults();
    doneEl.classList.add("cabinet__quiz-done--visible");
    submitResultToServer(lastTotals);
  }

  async function submitResultToServer(totals) {
    lastSubmissionId = null;
    if (!submitStatusEl) return;
    submitStatusEl.classList.remove("cabinet__result-submit-status--error");

    if (!DISC_AI_WORKER_URL || !employeeName) {
      submitStatusEl.textContent = "";
      return;
    }

    submitStatusEl.textContent = "Отправляем результат ответственному лицу…";
    try {
      const resp = await fetch(DISC_AI_WORKER_URL + "/disc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: employeeName,
          department: employeeDept,
          scores: totals,
          answers: answers,
        }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json().catch(function () { return null; });
      if (data && data.id) lastSubmissionId = data.id;
      submitStatusEl.textContent = "Результат отправлен ответственному лицу.";
    } catch (err) {
      submitStatusEl.classList.add("cabinet__result-submit-status--error");
      submitStatusEl.textContent =
        "Не удалось отправить результат в общую базу — но он сохранён в этом браузере.";
    }
  }

  async function submitAiToServer(report) {
    if (!DISC_AI_WORKER_URL || !lastSubmissionId) return;
    try {
      await fetch(DISC_AI_WORKER_URL + "/disc/submit/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lastSubmissionId, report: report }),
      });
    } catch (err) {}
  }

  async function requestAiReport() {
    if (!lastTotals) return;

    if (!DISC_AI_WORKER_URL) {
      aiStatusEl.textContent =
        "ИИ-функция ещё не подключена — см. инструкцию в /cloudflare-worker/README.md.";
      aiStatusEl.classList.add("cabinet__result-ai-status--error");
      return;
    }

    aiBtn.disabled = true;
    aiBtn.textContent = "Формируем…";
    aiStatusEl.classList.remove("cabinet__result-ai-status--error");
    aiStatusEl.textContent = "Запрашиваем персональный разбор у ИИ…";

    try {
      const resp = await fetch(DISC_AI_WORKER_URL + "/disc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: lastTotals, name: employeeName }),
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data || !data.decoding) throw new Error("Пустой ответ");

      renderDiscReport({ chartEl, tableEl, textEl }, lastTotals, lastCounts, data);

      saveDiscResult(lastTotals, lastCounts, data);
      if (window.refreshDiscResultsPanel) window.refreshDiscResultsPanel();
      submitAiToServer(data);

      aiBtn.textContent = "Отчёт сформирован";
      aiStatusEl.textContent = "Готово — тексты выше персонализированы ИИ.";
    } catch (err) {
      aiBtn.disabled = false;
      aiBtn.textContent = "Сформировать отчёт";
      aiStatusEl.classList.add("cabinet__result-ai-status--error");
      aiStatusEl.textContent = "Не получилось сформировать отчёт. Попробуйте ещё раз.";
    }
  }

  function openQuiz() {
    employeeName = "";
    employeeDept = "";
    lastSubmissionId = null;
    if (nameInput) nameInput.value = "";
    if (deptInput) deptInput.value = "";
    if (startErrorEl) startErrorEl.style.display = "none";

    startEl.style.display = "";
    progressEl.style.display = "none";
    bodyEl.style.display = "none";
    navEl.style.display = "none";
    doneEl.classList.remove("cabinet__quiz-done--visible");

    listView.style.display = "none";
    quiz.classList.add("cabinet__quiz--visible");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        quiz.classList.add("cabinet__quiz--active");
      });
    });

    if (nameInput) nameInput.focus();
  }

  function startQuizAfterForm() {
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) {
      if (startErrorEl) {
        startErrorEl.textContent = "Пожалуйста, укажите ФИО.";
        startErrorEl.style.display = "";
      }
      return;
    }
    employeeName = name;
    employeeDept = deptInput ? deptInput.value.trim() : "";

    current = 0;
    answers.forEach((a) => {
      a.most = null;
      a.least = null;
    });
    renderQuestion();
  }

  function closeQuiz() {
    quiz.classList.remove("cabinet__quiz--active");
    quiz.addEventListener(
      "transitionend",
      function hide(event) {
        if (event.propertyName !== "opacity") return;
        quiz.removeEventListener("transitionend", hide);
        if (quiz.classList.contains("cabinet__quiz--active")) return;
        quiz.classList.remove("cabinet__quiz--visible");
      }
    );
    listView.style.display = "";
  }

  document.querySelectorAll('[data-quiz="disc"]').forEach((trigger) => {
    trigger.addEventListener("click", openQuiz);
    trigger.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openQuiz();
      }
    });
  });

  backBtn.addEventListener("click", closeQuiz);
  aiBtn.addEventListener("click", requestAiReport);
  if (startEl) {
    startEl.addEventListener("submit", function (event) {
      event.preventDefault();
      startQuizAfterForm();
    });
  }
  restartBtn.addEventListener("click", openQuiz);

  prevBtn.addEventListener("click", function () {
    if (current > 0) {
      current--;
      renderQuestion();
    }
  });

  nextBtn.addEventListener("click", function () {
    if (!isAnswered(current)) return;
    if (current < DISC_QUESTIONS.length - 1) {
      current++;
      renderQuestion();
    } else {
      showDone();
    }
  });
})();
