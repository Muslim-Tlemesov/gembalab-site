// Тест (опросник) Р.М. Белбина — командные роли. Добавлен по тому же
// принципу, что и Тест Маслоу (см. quiz-maslow.js): прохождение и отчёт
// внутри панели "Список тестов и анкет", результат сохраняется в этом
// браузере (localStorage) и параллельно отправляется в общую базу на
// сервере (тот же Cloudflare Worker, см. /cloudflare-worker), чтобы владелец
// сайта видел результаты сотрудников в админке (admin.html).
//
// Формат теста другой, чем у Маслоу: 7 вопросов, в каждом — 8 вариантов
// ответа (по одному на каждую из 8 ролей), и вместо выбора одного варианта
// нужно распределить между вариантами ровно 10 баллов — так, как это
// устроено в исходном бумажном опроснике (см. фото теста). Кто получил
// сколько баллов по каждой роли — секрет от сотрудника во время
// прохождения: варианты показываются без названий ролей, роль
// подставляется только при подсчёте результата.
//
// Соответствие вариантов ответа ролям определено по смыслу самих
// формулировок (в данной версии опросника это авторский перевод/парафраз
// без готового "ключа" с официальными буквами) — см. пояснение в каждом
// вопросе ниже.

const BELBIN_AI_WORKER_URL = "https://gembalab-maslow-report.gembalab.workers.dev";

// Порядок ролей — как в примере итогового отчёта (таблица баллов).
const BELBIN_ROLE_ORDER = [
  "coordinator",
  "generator",
  "tvorets",
  "issledovatel",
  "ekspert",
  "diplomat",
  "realizator",
  "ispolnitel",
];

const BELBIN_ROLE_LABELS = {
  coordinator: "Координатор",
  generator: "Генератор идей",
  tvorets: "Творец",
  issledovatel: "Исследователь",
  ekspert: "Эксперт",
  diplomat: "Дипломат",
  realizator: "Реализатор",
  ispolnitel: "Исполнитель",
};

// Короткое описание "от второго лица" — используется как запасной вариант
// текста результата, пока не запрошен персональный ИИ-отчёт (по аналогии с
// MASLOW_EXPLANATIONS в quiz-maslow.js).
const BELBIN_ROLE_TEMPLATES = {
  coordinator:
    "Вы — прирождённый организатор: легко распределяете задачи, находите сильные стороны в людях и умеете направить разных специалистов к общей цели. Вам доверяют, потому что вы скорее советуетесь и объединяете, чем давите.",
  generator:
    "Вы генерируете нестандартные идеи и предлагаете решения, до которых другие ещё не додумались. Вам комфортнее обдумывать замысел самостоятельно, а не в шумной группе — зато именно ваши идеи часто становятся стартом для новых проектов.",
  tvorets:
    "Вы заряжены на результат и не боитесь брать на себя ответственность, когда нужно сдвинуть дело с мёртвой точки. Вы напористы, готовы отстаивать своё мнение и подталкивать команду к действию, даже если это не всем нравится.",
  issledovatel:
    "Вы легко заводите контакты, находите новые возможности и ресурсы за пределами команды. Вам интересны идеи других людей, вы умеете их подхватить и развить — а без живого общения быстро теряете запал.",
  ekspert:
    "Вы трезво оцениваете ситуацию, взвешиваете все варианты и редко ошибаетесь в суждениях. Не спешите с решением, предпочитая сначала как следует всё обдумать и найти слабые места в предложениях.",
  diplomat:
    "Вы сглаживаете трения в команде и помогаете всем сотрудничать без лишних конфликтов. Вы чуткий, гибкий, умеете слушать и подстраиваться под разных людей — команда держится на таких, как вы.",
  realizator:
    "Вы практичны, дисциплинированы и системны — умеете превращать идеи в конкретные шаги и доводить процессы до порядка. На вас можно положиться, когда нужно просто сделать то, что нужно делу, без лишней суеты.",
  ispolnitel:
    "Вы очень внимательны к деталям и не успокоитесь, пока задача не доведена до конца. Вы редко делегируете, потому что вам важно, чтобы всё было сделано аккуратно и в срок — команда может на вас положиться в вопросах качества.",
};

// 7 вопросов × 8 вариантов. Каждый вариант помечен ролью (role), к которой
// он относится при подсчёте баллов — сотруднику эта метка не показывается.
const BELBIN_QUESTIONS = [
  {
    text: "Что я могу дать своей команде?",
    options: [
      { text: "Я быстро замечаю и использую новые возможности", role: "issledovatel" },
      { text: "Мне легко находить общий язык с разными людьми", role: "diplomat" },
      { text: "Мне легко придумывать новые идеи", role: "generator" },
      { text: "Я умею находить людей, которые помогут команде добиться успеха", role: "coordinator" },
      { text: "Я умею доводить дела до конца", role: "ispolnitel" },
      { text: "Мне сложно жертвовать своей популярностью или симпатией окружающих, даже ради пользы для команды или результата", role: "tvorets" },
      { text: "Я хорошо понимаю, что реально, а что — нет", role: "ekspert" },
      { text: "Я могу предложить другой вариант действий и спокойно его объяснить, не вызывая конфликтов", role: "realizator" },
    ],
  },
  {
    text: "Что может мешать мне как участнику команды?",
    options: [
      { text: "Мне некомфортно на рабочих встречах, даже если они хорошо организованы", role: "ekspert" },
      { text: "Я часто соглашаюсь с теми, кто уверенно говорит, даже до того, как всё обсудим", role: "diplomat" },
      { text: "Когда обсуждаются идеи, я могу слишком много говорить", role: "issledovatel" },
      { text: "Личные симпатии или антипатии мешают мне поддерживать некоторых коллег", role: "realizator" },
      { text: "Иногда люди считают, что я слишком жёстко и командно берусь за дело", role: "tvorets" },
      { text: "Мне трудно быть лидером, потому что я слишком сильно переживаю из-за настроений в группе", role: "coordinator" },
      { text: "Я так увлекаюсь своими идеями, что могу не заметить, что происходит вокруг", role: "generator" },
      { text: "Коллеги считают, что я зацикливаюсь на мелочах и боюсь рисковать, чтобы не испортить дело", role: "ispolnitel" },
    ],
  },
  {
    text: "Когда я работаю в команде над проектом",
    options: [
      { text: "Я умею влиять на людей без давления и принуждения", role: "coordinator" },
      { text: "У меня есть интуиция, которая помогает избежать ошибок и недосмотров", role: "realizator" },
      { text: "Ради цели я могу ускорить работу и не тратить время на долгие обсуждения", role: "tvorets" },
      { text: "Я часто предлагаю необычные, креативные идеи", role: "generator" },
      { text: "Я всегда поддержу полезную идею, которая выгодна для всех", role: "diplomat" },
      { text: "Мне интересно следить за новыми идеями и современными подходами", role: "issledovatel" },
      { text: "Я умею хорошо анализировать ситуацию и помочь принять верное решение", role: "ekspert" },
      { text: "На меня можно положиться, когда дело нужно довести до конца", role: "ispolnitel" },
    ],
  },
  {
    text: "Как я отношусь к командной работе?",
    options: [
      { text: "Мне действительно интересно лучше узнать своих коллег", role: "diplomat" },
      { text: "Я не боюсь спорить и могу остаться при своём мнении, даже если большинство против", role: "tvorets" },
      { text: "Я умею объяснить, почему плохая идея не сработает", role: "ekspert" },
      { text: "Я готов выполнять любую задачу, если это помогает общей цели", role: "realizator" },
      { text: "Вместо очевидных решений я часто нахожу неожиданные и креативные", role: "generator" },
      { text: "Я стараюсь доводить свою работу до идеала", role: "ispolnitel" },
      { text: "Я могу подключить полезные контакты вне команды, если это поможет", role: "issledovatel" },
      { text: "Я открыт к разным мнениям, но умею быстро и уверенно принимать решения", role: "coordinator" },
    ],
  },
  {
    text: "Что приносит мне удовольствие в работе?",
    options: [
      { text: "Мне нравится разбираться в ситуации и выбирать лучшие варианты действий", role: "ekspert" },
      { text: "Мне интересно находить практичные, рабочие решения", role: "realizator" },
      { text: "Мне важно, что я помогаю создать хорошую атмосферу в команде", role: "diplomat" },
      { text: "Я чувствую, что часто влияю на важные решения", role: "coordinator" },
      { text: "Я легко общаюсь с людьми, которые приносят новые идеи", role: "issledovatel" },
      { text: "Я умею убеждать других, если считаю, что нужно действовать определённым образом", role: "tvorets" },
      { text: "Мне приятно работать в спокойной обстановке, когда могу полностью сосредоточиться", role: "ispolnitel" },
      { text: "Мне нравится работать над задачами, которые развивают моё воображение", role: "generator" },
    ],
  },
  {
    text: "Если задача сложная и новая…",
    options: [
      { text: "Я беру паузу, чтобы спокойно подумать над проблемой", role: "ekspert" },
      { text: "Я стараюсь работать с теми, кто настроен позитивно и с энтузиазмом", role: "issledovatel" },
      { text: "Я ищу, кому можно передать часть задачи, чтобы упростить решение", role: "coordinator" },
      { text: "У меня хорошее чувство времени — я умею укладываться в сроки", role: "ispolnitel" },
      { text: "Я стараюсь сохранять ясность ума и спокойствие", role: "diplomat" },
      { text: "Даже под давлением я не отступаю от цели", role: "realizator" },
      { text: "Я могу взять на себя руководство, если вижу, что группа застопорилась", role: "tvorets" },
      { text: "Я бы начал обсуждение, чтобы запустить новые идеи", role: "generator" },
    ],
  },
  {
    text: "Какие трудности у меня могут возникать в командной работе?",
    options: [
      { text: "Я раздражаюсь на тех, кто мешает двигаться вперёд", role: "tvorets" },
      { text: "Меня могут критиковать за то, что я слишком всё анализирую и не доверяю интуиции", role: "ekspert" },
      { text: "Стремление к качеству иногда замедляет мою работу", role: "ispolnitel" },
      { text: "Мне быстро становится неинтересно, и я жду, что кто-то меня замотивирует", role: "issledovatel" },
      { text: "Мне трудно начать, если нет чёткой цели", role: "realizator" },
      { text: "Мне бывает сложно объяснить проблему полностью", role: "generator" },
      { text: "Я могу требовать от других того, что сам не всегда делаю", role: "coordinator" },
      { text: "Мне трудно высказываться, если моё мнение отличается от большинства", role: "diplomat" },
    ],
  },
];

const BELBIN_POINTS_PER_QUESTION = 10;
const BELBIN_MAX_PER_ROLE = BELBIN_QUESTIONS.length * BELBIN_POINTS_PER_QUESTION; // 70

// Ведущие роли — топ-2, или топ-3, если третья набрала столько же баллов,
// сколько вторая (явная ничья).
function belbinTopRoles(totals) {
  const ranked = BELBIN_ROLE_ORDER.map((key) => ({ key, label: BELBIN_ROLE_LABELS[key], score: totals[key] })).sort(
    (a, b) => b.score - a.score
  );
  let count = 2;
  if (ranked[2] && ranked[1] && ranked[2].score === ranked[1].score) count = 3;
  return ranked.slice(0, count);
}

const BELBIN_STORAGE_KEY = "gembalab_belbin_result_v1";

function saveBelbinResult(totals, byQuestion, aiData) {
  try {
    localStorage.setItem(
      BELBIN_STORAGE_KEY,
      JSON.stringify({ totals: totals, byQuestion: byQuestion, ai: aiData || null, savedAt: Date.now() })
    );
  } catch (e) {}
}

function loadBelbinResult() {
  try {
    const raw = localStorage.getItem(BELBIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearBelbinResult() {
  try {
    localStorage.removeItem(BELBIN_STORAGE_KEY);
  } catch (e) {}
}

// Общая отрисовка отчёта (таблица баллов по ролям и вопросам + топ-роли +
// персональный текст) — используется и на экране результатов внутри теста,
// и в разделе "Результаты" личного кабинета, и (переиспользуется тем же
// способом) в админке.
function renderBelbinReport(els, totals, byQuestion, aiData) {
  const top = belbinTopRoles(totals);
  const topKeys = top.map((t) => t.key);

  // таблица: роли × вопросы + итого
  els.tableEl.innerHTML = "";
  const table = document.createElement("table");
  table.className = "cabinet__belbin-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML =
    "<th>Роль</th>" +
    BELBIN_QUESTIONS.map((_, i) => "<th>" + (i + 1) + "</th>").join("") +
    "<th>Всего</th>";
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  BELBIN_ROLE_ORDER.forEach((key) => {
    const tr = document.createElement("tr");
    if (topKeys.indexOf(key) !== -1) tr.className = "cabinet__belbin-top";
    let cells = "<td>" + BELBIN_ROLE_LABELS[key] + "</td>";
    BELBIN_QUESTIONS.forEach((_, qi) => {
      const val = byQuestion && byQuestion[qi] ? byQuestion[qi][key] || 0 : 0;
      cells += "<td>" + val + "</td>";
    });
    cells += "<td><strong>" + totals[key] + "</strong></td>";
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  els.tableEl.appendChild(table);

  // ведущие роли
  els.topEl.innerHTML = "";
  const topTitle = document.createElement("p");
  topTitle.className = "cabinet__placeholder";
  topTitle.style.marginBottom = "14px";
  topTitle.innerHTML =
    (top.length === 2 ? "Ваши ведущие роли: " : "Ваши ведущие роли (ничья по баллам): ") +
    "<strong>" + top.map((t) => t.label).join(", ") + "</strong>.";
  els.topEl.appendChild(topTitle);

  if (aiData && aiData.intro) {
    const introP = document.createElement("p");
    introP.className = "cabinet__result-item-text";
    introP.style.marginBottom = "18px";
    introP.textContent = aiData.intro;
    els.topEl.appendChild(introP);
  }

  top.forEach((t) => {
    const aiRole = aiData && Array.isArray(aiData.roles) ? aiData.roles.find((r) => r.role === t.label) : null;
    const aiText = aiRole && aiRole.text;
    const item = document.createElement("div");
    item.className = "cabinet__result-item" + (aiText ? " cabinet__result-item--ai" : "");
    const title = document.createElement("div");
    title.className = "cabinet__result-item-title";
    title.textContent = t.label + " (" + t.score + " из " + BELBIN_MAX_PER_ROLE + ")";
    const text = document.createElement("p");
    text.className = "cabinet__result-item-text";
    text.textContent = aiText || BELBIN_ROLE_TEMPLATES[t.key];
    item.appendChild(title);
    item.appendChild(text);
    els.topEl.appendChild(item);
  });
}

// Раздел "Результаты" личного кабинета — свой блок под блоком Маслоу,
// читает сохранённый результат из localStorage.
(function () {
  const emptyEl = document.getElementById("belbinResultsEmpty");
  const filledEl = document.getElementById("belbinResultsFilled");
  if (!emptyEl || !filledEl) return;

  const dateEl = document.getElementById("belbinResultsDate");
  const clearBtn = document.getElementById("belbinResultsClear");
  const resultsEls = {
    tableEl: document.getElementById("belbinResultsTable"),
    topEl: document.getElementById("belbinResultsTop"),
  };

  window.refreshBelbinResultsPanel = function () {
    const saved = loadBelbinResult();
    if (!saved || !saved.totals) {
      emptyEl.style.display = "";
      filledEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    filledEl.style.display = "";
    renderBelbinReport(resultsEls, saved.totals, saved.byQuestion, saved.ai);
    if (dateEl) {
      const d = saved.savedAt ? new Date(saved.savedAt) : null;
      dateEl.textContent = d
        ? "Сохранено: " + d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "";
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Удалить сохранённый результат теста Белбина?")) return;
      clearBelbinResult();
      window.refreshBelbinResultsPanel();
    });
  }

  window.refreshBelbinResultsPanel();
})();

(function () {
  const listView = document.getElementById("testsListView");
  const quiz = document.getElementById("quizBelbin");
  if (!listView || !quiz) return;

  const progressEl = document.getElementById("quizBelbinProgress");
  const questionTextEl = document.getElementById("quizBelbinQuestionText");
  const optionsEl = document.getElementById("quizBelbinOptions");
  const totalEl = document.getElementById("quizBelbinTotal");
  const prevBtn = document.getElementById("quizBelbinPrev");
  const nextBtn = document.getElementById("quizBelbinNext");
  const backBtn = document.getElementById("quizBelbinBack");
  const restartBtn = document.getElementById("quizBelbinRestart");
  const bodyEl = document.getElementById("quizBelbinBody");
  const navEl = quiz.querySelector(".cabinet__quiz-nav");
  const doneEl = document.getElementById("quizBelbinDone");

  const tableEl = document.getElementById("quizBelbinTable");
  const topEl = document.getElementById("quizBelbinTop");
  const aiBtn = document.getElementById("quizBelbinAiBtn");
  const aiStatusEl = document.getElementById("quizBelbinAiStatus");
  const submitStatusEl = document.getElementById("quizBelbinSubmitStatus");

  const startEl = document.getElementById("quizBelbinStart");
  const nameInput = document.getElementById("quizBelbinName");
  const deptInput = document.getElementById("quizBelbinDept");
  const startErrorEl = document.getElementById("quizBelbinStartError");

  // answers[i] — массив из 8 чисел (баллы по вариантам вопроса i, в порядке
  // вариантов из BELBIN_QUESTIONS[i].options).
  const answers = BELBIN_QUESTIONS.map((q) => q.options.map(() => 0));
  let current = 0;
  let lastTotals = null;
  let lastByQuestion = null;
  let employeeName = "";
  let employeeDept = "";
  let lastSubmissionId = null;

  function questionTotal(i) {
    return answers[i].reduce((sum, v) => sum + v, 0);
  }

  function renderProgress() {
    progressEl.innerHTML = "";
    BELBIN_QUESTIONS.forEach((_, i) => {
      const item = document.createElement("div");
      item.className = "cabinet__quiz-progress-item";
      if (questionTotal(i) === BELBIN_POINTS_PER_QUESTION) item.classList.add("cabinet__quiz-progress-item--answered");
      if (i === current) item.classList.add("cabinet__quiz-progress-item--active");
      item.textContent = i + 1;
      progressEl.appendChild(item);
    });
  }

  function renderTotal() {
    const total = questionTotal(current);
    totalEl.textContent = "Распределено: " + total + " из " + BELBIN_POINTS_PER_QUESTION + " баллов";
    totalEl.classList.toggle("cabinet__quiz-points-total--ok", total === BELBIN_POINTS_PER_QUESTION);
    totalEl.classList.toggle("cabinet__quiz-points-total--error", total > BELBIN_POINTS_PER_QUESTION);
    nextBtn.disabled = total !== BELBIN_POINTS_PER_QUESTION;
  }

  function renderQuestion() {
    startEl.style.display = "none";
    progressEl.style.display = "";
    bodyEl.style.display = "";
    navEl.style.display = "";
    doneEl.classList.remove("cabinet__quiz-done--visible");

    const q = BELBIN_QUESTIONS[current];
    questionTextEl.textContent = q.text;
    optionsEl.innerHTML = "";

    q.options.forEach((opt, i) => {
      const row = document.createElement("div");
      row.className = "cabinet__quiz-points-row";

      const span = document.createElement("span");
      span.className = "cabinet__quiz-points-label";
      span.textContent = opt.text;

      const input = document.createElement("input");
      input.type = "number";
      input.className = "cabinet__quiz-points-input";
      input.min = "0";
      input.max = String(BELBIN_POINTS_PER_QUESTION);
      input.step = "1";
      input.inputMode = "numeric";
      input.value = String(answers[current][i]);
      input.addEventListener("input", function () {
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        if (val > BELBIN_POINTS_PER_QUESTION) val = BELBIN_POINTS_PER_QUESTION;
        answers[current][i] = val;
        renderProgress();
        renderTotal();
      });

      row.appendChild(span);
      row.appendChild(input);
      optionsEl.appendChild(row);
    });

    prevBtn.disabled = current === 0;
    nextBtn.textContent = current === BELBIN_QUESTIONS.length - 1 ? "Завершить тест" : "Далее";

    renderTotal();
    renderProgress();
  }

  function computeScores() {
    const totals = {};
    BELBIN_ROLE_ORDER.forEach((key) => (totals[key] = 0));
    const byQuestion = BELBIN_QUESTIONS.map((q, qi) => {
      const perRole = {};
      q.options.forEach((opt, oi) => {
        const points = answers[qi][oi] || 0;
        perRole[opt.role] = (perRole[opt.role] || 0) + points;
        totals[opt.role] += points;
      });
      return perRole;
    });
    return { totals, byQuestion };
  }

  function renderResults() {
    const { totals, byQuestion } = computeScores();
    lastTotals = totals;
    lastByQuestion = byQuestion;
    aiStatusEl.textContent = "";
    aiStatusEl.classList.remove("cabinet__result-ai-status--error");
    aiBtn.disabled = false;
    aiBtn.textContent = "Сформировать отчёт";

    renderBelbinReport({ tableEl, topEl }, totals, byQuestion, null);

    saveBelbinResult(totals, byQuestion, null);
    if (window.refreshBelbinResultsPanel) window.refreshBelbinResultsPanel();
  }

  function showDone() {
    bodyEl.style.display = "none";
    navEl.style.display = "none";
    renderResults();
    doneEl.classList.add("cabinet__quiz-done--visible");
    submitResultToServer(lastTotals, lastByQuestion);
  }

  async function submitResultToServer(totals, byQuestion) {
    lastSubmissionId = null;
    if (!submitStatusEl) return;
    submitStatusEl.classList.remove("cabinet__result-submit-status--error");

    if (!BELBIN_AI_WORKER_URL || !employeeName) {
      submitStatusEl.textContent = "";
      return;
    }

    submitStatusEl.textContent = "Отправляем результат ответственному лицу…";
    try {
      const resp = await fetch(BELBIN_AI_WORKER_URL + "/belbin/submit", {
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

  async function submitAiToServer(data) {
    if (!BELBIN_AI_WORKER_URL || !lastSubmissionId) return;
    try {
      await fetch(BELBIN_AI_WORKER_URL + "/belbin/submit/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lastSubmissionId,
          intro: data.intro,
          roles: data.roles,
        }),
      });
    } catch (err) {}
  }

  async function requestAiReport() {
    if (!lastTotals) return;

    if (!BELBIN_AI_WORKER_URL) {
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
      const resp = await fetch(BELBIN_AI_WORKER_URL + "/belbin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: lastTotals, name: employeeName }),
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data || !data.roles) throw new Error("Пустой ответ");

      renderBelbinReport({ tableEl, topEl }, lastTotals, lastByQuestion, data);

      saveBelbinResult(lastTotals, lastByQuestion, data);
      if (window.refreshBelbinResultsPanel) window.refreshBelbinResultsPanel();
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
    answers.forEach((row) => row.fill(0));
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

  document.querySelectorAll('[data-quiz="belbin"]').forEach((trigger) => {
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
    if (questionTotal(current) !== BELBIN_POINTS_PER_QUESTION) return;
    if (current < BELBIN_QUESTIONS.length - 1) {
      current++;
      renderQuestion();
    } else {
      showDone();
    }
  });
})();
