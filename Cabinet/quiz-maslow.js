// Тест Маслоу — прохождение теста и отчёт по результатам внутри панели
// "Список тестов и анкет". Все 20 вопросов сгруппированы по 5 в каждую из
// 4 потребностей (как в оригинальном тесте на kaidzen.kz), часть вопросов
// работает "в обратную сторону" (rev: true) — согласие с ними означает
// НИЗКУЮ потребность, а не высокую.
//
// Реальные баллы считаются по ответам пользователя. Текст "Расшифровки"
// и вступление к рекомендациям по умолчанию собраны по шаблонам (3 варианта
// на каждую потребность), а кнопка "Сформировать отчёт" запрашивает
// персональный текст у бесплатного ИИ (Cloudflare Workers AI) через
// отдельную серверную функцию — см. папку /cloudflare-worker, там же
// инструкция по бесплатному деплою (карта не нужна). Пока адрес функции
// не указан ниже — кнопка сразу сообщает об этом и ничего никуда не
// отправляет.
//
// Результат теста (баллы + текст ИИ, если он был сформирован) сохраняется
// в localStorage этого браузера и появляется в разделе "Результаты" личного
// кабинета. Никакого сервера/аккаунта для этого нет — если открыть сайт
// в другом браузере или на другом устройстве, результата там не будет.
// Остальной кабинет (профиль, оплаты и т.д.) по-прежнему просто витрина.

// Вставь сюда адрес своего Cloudflare Worker после деплоя (см. README в
// /cloudflare-worker), например:
// "https://gembalab-maslow-report.твой-логин.workers.dev"
const MASLOW_AI_WORKER_URL = "https://gembalab-maslow-report.gembalab.workers.dev";

const MASLOW_OPTIONS = [
  "совершенно верно и точно",
  "в большей степени верно и точно",
  "частично верно и точно",
  "в некоторой степени верно и точно",
  "совершенно не верно",
];

const MASLOW_QUESTIONS = [
  { text: "Спокойная работа — самое главное для меня", cat: "safety", rev: false },
  { text: "Я предпочитаю работать независимо, самостоятельно", cat: "belonging", rev: true },
  { text: "Высокая зарплата — наилучшее свидетельство ценности человека в компании", cat: "esteem", rev: false },
  { text: "Поиск того, что сделает меня счастливым — самое важное в жизни", cat: "selfact", rev: false },
  { text: "Безопасность работы — не самый важный фактор для меня", cat: "safety", rev: true },
  { text: "Мои друзья значат для меня больше, чем что-либо ещё", cat: "belonging", rev: false },
  { text: "Большинство людей думают, что они лучше, чем есть на самом деле", cat: "esteem", rev: false },
  { text: "Я хочу иметь работу, которая позволяла бы мне научиться чему-то новому и развивать мои способности", cat: "selfact", rev: false },
  { text: "Регулярный доход, на который я могу рассчитывать, является решающим для меня", cat: "safety", rev: false },
  { text: "Лучше избегать очень близких отношений с коллегами по работе", cat: "belonging", rev: true },
  { text: "Моя самооценка наиболее важна для меня, чем чьё-либо мнение", cat: "esteem", rev: false },
  { text: "Погоня за мечтой — это пустая трата времени", cat: "selfact", rev: true },
  { text: "Хорошая работа должна включать хороший план ухода на пенсию", cat: "safety", rev: false },
  { text: "Предпочитаю работу, предполагающую общение с другими людьми — клиентами и коллегами", cat: "belonging", rev: false },
  { text: "Я злюсь, когда кто-то присваивает себе работу, сделанную мной", cat: "esteem", rev: false },
  { text: "Идти всё дальше, устанавливать собственные лимиты — вот то, что мной движет", cat: "selfact", rev: false },
  { text: "Самый важный аспект работы в компании — хороший план страховки здоровья", cat: "safety", rev: false },
  { text: "Для меня очень важно быть частью сплочённой группы", cat: "belonging", rev: false },
  { text: "Мои достижения дают мне право уважать себя", cat: "esteem", rev: false },
  { text: "Я чувствую себя лучше, когда делаю то, что умею, чем когда пытаюсь выполнять что-то новое", cat: "selfact", rev: true },
];

const MASLOW_CATEGORIES = [
  { key: "safety", label: "Потребность в безопасности" },
  { key: "belonging", label: "Потребность в принадлежности к обществу" },
  { key: "esteem", label: "Потребность в уважении и признании" },
  { key: "selfact", label: "Потребность в самореализации" },
];

const MASLOW_MAX_PER_CATEGORY = 25; // 5 вопросов × максимум 5 баллов

const MASLOW_EXPLANATIONS = {
  safety: {
    high: "Про вас: вам важно, чтобы было спокойно и понятно — стабильный доход, здоровье под контролем, ясные правила игры. В жизни вы любите план, подстраховки и «запасной выход», скорее выберете надёжность, чем риск. Почему важно: крепкая база облегчает всё остальное — но есть риск застрять в «вечной подготовке» и откладывать интересные шансы.",
    medium: "Про вас: стабильность важна, но не любой ценой — вы готовы иногда рисковать ради результата. Почему важно: сохраняйте финансовую подушку и понятные правила, не превращая их в тормоз для развития.",
    low: "Про вас: предсказуемость и гарантии не в приоритете — вы легче остальных переносите неопределённость. Почему важно: минимальный запас прочности всё же стоит держать, чтобы не выгорать от постоянного риска.",
  },
  belonging: {
    high: "Про вас: вы «про людей» — важны своя команда, коллектив, чувство «я не один». В жизни цените дружеские встречи, командные проекты, атмосферу поддержки. Почему важно: связь с людьми даёт энергию и идеи — риск в том, чтобы угождать всем, забывая о своих целях.",
    medium: "Про вас: вам комфортно и в команде, и в самостоятельной работе — жёсткой потребности постоянно быть «в стае» нет. Почему важно: пары надёжных контактов обычно достаточно, чтобы не терять поддержку в сложные моменты.",
    low: "Про вас: вы прекрасно обходитесь без плотного круга общения на работе и цените самостоятельность. Почему важно: даже небольшая опора на коллег помогает в трудные периоды — не стоит закрываться совсем.",
  },
  esteem: {
    high: "Про вас: признание и статус — сильный драйвер, важно видеть, что ваш вклад замечают. Почему важно: признание — топливо для уверенности, но полезно учиться хвалить себя и без постоянной внешней оценки.",
    medium: "Про вас: признание приятно, но не критично — вы делаете дело и без постоянных аплодисментов. Почему важно: небольшая доза видимости результатов помогает расти быстрее, не полагайтесь только на самооценку.",
    low: "Про вас: хочется видеть, что вклад замечают, но местами ощущается недооценка, или скромность мешает заявлять о себе. В жизни делаете хорошо, но не всегда заметно — иногда думаете «да это ничего особенного» и молчите. Почему важно: признание — топливо для уверенности, без него сложнее браться за более смелые задачи.",
  },
  selfact: {
    high: "Про вас: хочется расти и делать «своё» — большие идеи есть, и вы находите для них время. Почему важно: именно тут энергия и смысл — продолжайте выделять на это регулярные слоты, не давая рутине их вытеснить.",
    medium: "Про вас: хочется расти и делать «своё», но безопасность и люди пока важнее. Большие идеи есть, но им не всегда хватает времени и фокуса — есть проекты «для души», которые откладываются «на потом». Почему важно: если это долго откладывать, накапливается чувство «я могу больше, но не начинаю».",
    low: "Про вас: рост «для души» пока не в приоритете — важнее то, что уже привычно и стабильно. Почему важно: небольшой проект с личным смыслом добавляет энергии даже при плотном графике — не обязательно начинать с чего-то масштабного.",
  },
};

const MASLOW_TIPS = {
  safety: [
    "Финансовая подушка: откладывайте понемногу каждую неделю, цель — 3–6 месяцев расходов.",
    "«Контролируемый риск»: выделяйте 10–15% времени на эксперименты — маленькие ставки, понятные границы.",
    "Рутины спокойствия: сон, движение, порядок в делах — это ваш фундамент.",
  ],
  belonging: [
    "Выберите 2–3 ключевых круга (семья, друзья, профессиональное сообщество) и вкладывайтесь в них.",
    "Раз в неделю — один тёплый контакт «без повода»: короткий звонок или сообщение.",
    "Говорите «нет» лишним чатам и обязательствам, которые не питают.",
  ],
  esteem: [
    "Ведите «дневник достижений»: раз в неделю 5–10 минут фиксируйте, что сделали полезного.",
    "Делайте вклад видимым: раз в месяц короткое письмо, пост или демо «что сделал и чем это помогло».",
    "Попросите конкретную обратную связь у 2–3 людей: «Что я делаю хорошо? Где могу усилиться?»",
    "Маленькие публичные шаги: выступление на внутренней встрече, мини-обучение коллег, менторство новичка.",
  ],
  selfact: [
    "Выберите один проект с личным смыслом — небольшой, на 6–8 недель.",
    "Забронируйте два слота по 90 минут в неделю — «время, которое нельзя съесть встречами».",
    "Учитесь по делу: короткие микромодули по 30–40 минут, которые сразу применяете в проекте.",
    "Делайте результаты осязаемыми: прототип, статья, чек-лист, мини-сервис — видимый итог поддерживает мотивацию.",
  ],
};

const MASLOW_APPENDIX = {
  safety: [
    "Конкурентный уровень оплаты труда",
    "«Белая» зарплата",
    "Материальная поддержка при значимых событиях в жизни работника и в критические моменты жизни",
    "Имидж сильной и динамичной компании",
    "Статус работника успешного, современного, стабильного предприятия",
    "Корпоративные мероприятия и праздники",
    "Информирование сотрудников о долгосрочных перспективах деятельности компании",
    "Обучение персонала",
  ],
  belonging: [
    "Встречи с руководством",
    "Участие в общественных движениях, коллективах по интересам, кружках и т.д.",
    "Членство в различных ассоциациях",
    "Представление компании на выставках и конференциях",
    "Корпоративные мероприятия и праздники",
    "Обучение персонала",
    "Стимулирование кружков качества",
    "Коллектив",
    "Взаимоотношения внутри коллектива с коллегами и руководителями",
  ],
  esteem: [
    "Расширение полномочий",
    "Участие в совещаниях",
    "Название должности",
    "Карьерный рост",
    "Оплата дорогостоящего образования",
    "Публикации статей",
    "Представление компании на выставках, конференциях и пр.",
    "Звание лучшего по профессии",
    "Грамоты и благодарности",
    "Материальная поддержка при значимых событиях в жизни работника (в том числе ссуда на покупку квартиры, машины)",
    "Подарки",
    "Обед с генеральным директором",
    "Статус работника успешного современного предприятия",
    "Брендированная продукция и аксессуары",
    "Престиж работы",
  ],
  selfact: [
    "Стимулирование рационализаторских предложений и изобретательства",
    "Стимулирование кружков качества",
    "Возможность профессионального роста",
    "Обучение",
    "Участие в проектах",
    "Участие в общественных движениях, коллективах по интересам, кружках и т.д.",
  ],
};

function maslowTier(score) {
  if (score >= 18) return "high";
  if (score >= 11) return "medium";
  return "low";
}

function maslowTierLabel(tier) {
  if (tier === "high") return "высокая";
  if (tier === "medium") return "средняя";
  return "низкая";
}

// Сохранение результата теста — прямо в этом браузере (localStorage), без
// регистрации и без сервера. Поэтому результат виден только на этом
// устройстве и пропадёт при очистке данных браузера.
const MASLOW_STORAGE_KEY = "gembalab_maslow_result_v1";

function saveMaslowResult(scores, aiData) {
  try {
    localStorage.setItem(
      MASLOW_STORAGE_KEY,
      JSON.stringify({ scores: scores, ai: aiData || null, savedAt: Date.now() })
    );
  } catch (e) {
    // localStorage недоступен (приватный режим и т.п.) — просто не сохраняем.
  }
}

function loadMaslowResult() {
  try {
    const raw = localStorage.getItem(MASLOW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearMaslowResult() {
  try {
    localStorage.removeItem(MASLOW_STORAGE_KEY);
  } catch (e) {}
}

// Общая отрисовка отчёта (график + расшифровка + рекомендации + приложение).
// Используется и на экране результатов внутри самого теста, и в разделе
// "Результаты" личного кабинета — оба раза строит одинаковую разметку в
// переданные контейнеры. Если передан aiData — используется персональный
// текст ИИ вместо шаблонного.
function renderMaslowReport(els, totals, aiData) {
  const results = MASLOW_CATEGORIES.map((c) => ({
    ...c,
    score: totals[c.key],
    tier: maslowTier(totals[c.key]),
  }));

  // график
  els.chartEl.innerHTML = "";
  results.forEach((r) => {
    const col = document.createElement("div");
    col.className = "cabinet__result-bar-col";

    const bar = document.createElement("div");
    bar.className = "cabinet__result-bar" + (r.tier === "high" ? " cabinet__result-bar--high" : "");
    const pct = Math.max(6, Math.round((r.score / MASLOW_MAX_PER_CATEGORY) * 100));
    bar.style.height = pct + "%";
    bar.textContent = r.score;

    const label = document.createElement("div");
    label.className = "cabinet__result-bar-label";
    label.textContent = r.label;

    col.appendChild(bar);
    col.appendChild(label);
    els.chartEl.appendChild(col);
  });

  // баллы
  els.scoresEl.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    const tierSpan =
      '<span class="cabinet__result-tier' +
      (r.tier === "high" ? " cabinet__result-tier--high" : "") +
      '">' + maslowTierLabel(r.tier) + "</span>";
    li.innerHTML = "<span>" + r.label + "</span><span>" + r.score + " баллов · " + tierSpan + "</span>";
    els.scoresEl.appendChild(li);
  });

  // расшифровка (текст ИИ, если есть, иначе шаблон)
  els.breakdownEl.innerHTML = "";
  results.forEach((r) => {
    const aiText = aiData && aiData.breakdown && aiData.breakdown[r.key];
    const item = document.createElement("div");
    item.className = "cabinet__result-item" + (aiText ? " cabinet__result-item--ai" : "");
    item.dataset.cat = r.key;
    const title = document.createElement("div");
    title.className = "cabinet__result-item-title";
    title.textContent = r.label + " (" + r.score + ")";
    const text = document.createElement("p");
    text.className = "cabinet__result-item-text";
    text.textContent = aiText || MASLOW_EXPLANATIONS[r.key][r.tier];
    item.appendChild(title);
    item.appendChild(text);
    els.breakdownEl.appendChild(item);
  });

  // рекомендации — начиная с самых слабых потребностей
  const weak = results.filter((r) => r.tier !== "high").sort((a, b) => a.score - b.score);
  const strong = results.filter((r) => r.tier === "high");
  els.recommendEl.innerHTML = "";

  const intro = document.createElement("p");
  if (els.introId) intro.id = els.introId;
  intro.className = "cabinet__result-item-text";
  intro.style.marginBottom = "18px";
  if (aiData && aiData.recommendations_intro) {
    intro.textContent = aiData.recommendations_intro;
  } else if (weak.length === 0) {
    intro.textContent = "Все четыре потребности закрыты примерно одинаково хорошо — держите этот баланс и дальше.";
  } else if (strong.length === 0) {
    intro.textContent = "Ярко выраженного «сильного» полюса нет — стоит равномерно подтянуть все направления ниже.";
  } else {
    intro.textContent =
      "Главное — сохранить вашу сильную базу (" +
      strong.map((r) => r.label.replace("Потребность в ", "").replace("Потребность ", "")).join(", ") +
      "), при этом аккуратно поднимать: " +
      weak.map((r) => r.label.replace("Потребность в ", "").replace("Потребность ", "")).join(", ") +
      ".";
  }
  els.recommendEl.appendChild(intro);

  weak.forEach((r) => {
    const group = document.createElement("div");
    group.className = "cabinet__result-recommend-group";
    const title = document.createElement("div");
    title.className = "cabinet__result-recommend-title";
    title.textContent = r.label;
    const ul = document.createElement("ul");
    MASLOW_TIPS[r.key].forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      ul.appendChild(li);
    });
    group.appendChild(title);
    group.appendChild(ul);
    els.recommendEl.appendChild(group);
  });

  // приложение — статичный список факторов по каждой потребности
  els.appendixEl.innerHTML = "";
  MASLOW_CATEGORIES.forEach((c) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = c.label;
    const ul = document.createElement("ul");
    MASLOW_APPENDIX[c.key].forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      ul.appendChild(li);
    });
    details.appendChild(summary);
    details.appendChild(ul);
    els.appendixEl.appendChild(details);
  });

  return results;
}

// Раздел "Результаты" личного кабинета — читает сохранённый результат из
// localStorage и рисует его тем же способом, что и экран результатов теста.
(function () {
  const emptyEl = document.getElementById("maslowResultsEmpty");
  const filledEl = document.getElementById("maslowResultsFilled");
  if (!emptyEl || !filledEl) return;

  const dateEl = document.getElementById("maslowResultsDate");
  const clearBtn = document.getElementById("maslowResultsClear");
  const resultsEls = {
    chartEl: document.getElementById("maslowResultsChart"),
    scoresEl: document.getElementById("maslowResultsScores"),
    breakdownEl: document.getElementById("maslowResultsBreakdown"),
    recommendEl: document.getElementById("maslowResultsRecommend"),
    appendixEl: document.getElementById("maslowResultsAppendix"),
  };

  window.refreshMaslowResultsPanel = function () {
    const saved = loadMaslowResult();
    if (!saved || !saved.scores) {
      emptyEl.style.display = "";
      filledEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    filledEl.style.display = "";
    renderMaslowReport(resultsEls, saved.scores, saved.ai);
    if (dateEl) {
      const d = saved.savedAt ? new Date(saved.savedAt) : null;
      dateEl.textContent = d
        ? "Сохранено: " + d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "";
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Удалить сохранённый результат теста Маслоу?")) return;
      clearMaslowResult();
      window.refreshMaslowResultsPanel();
    });
  }

  window.refreshMaslowResultsPanel();
})();

(function () {
  const listView = document.getElementById("testsListView");
  const quiz = document.getElementById("quizMaslow");
  if (!listView || !quiz) return;

  const progressEl = document.getElementById("quizMaslowProgress");
  const questionTextEl = document.getElementById("quizMaslowQuestionText");
  const optionsEl = document.getElementById("quizMaslowOptions");
  const prevBtn = document.getElementById("quizMaslowPrev");
  const nextBtn = document.getElementById("quizMaslowNext");
  const backBtn = document.getElementById("quizMaslowBack");
  const restartBtn = document.getElementById("quizMaslowRestart");
  const bodyEl = document.getElementById("quizMaslowBody");
  const navEl = quiz.querySelector(".cabinet__quiz-nav");
  const doneEl = document.getElementById("quizMaslowDone");

  const chartEl = document.getElementById("quizMaslowChart");
  const scoresEl = document.getElementById("quizMaslowScores");
  const breakdownEl = document.getElementById("quizMaslowBreakdown");
  const recommendEl = document.getElementById("quizMaslowRecommend");
  const appendixEl = document.getElementById("quizMaslowAppendix");
  const aiBtn = document.getElementById("quizMaslowAiBtn");
  const aiStatusEl = document.getElementById("quizMaslowAiStatus");
  const submitStatusEl = document.getElementById("quizMaslowSubmitStatus");

  const startEl = document.getElementById("quizMaslowStart");
  const nameInput = document.getElementById("quizMaslowName");
  const deptInput = document.getElementById("quizMaslowDept");
  const startErrorEl = document.getElementById("quizMaslowStartError");

  const answers = new Array(MASLOW_QUESTIONS.length).fill(null);
  let current = 0;
  let lastScores = null; // баллы последнего пройденного теста — нужны кнопке "Сформировать отчёт"
  let employeeName = ""; // ФИО, введённое перед началом теста — для общей базы результатов
  let employeeDept = ""; // отдел/должность, введённые перед началом теста

  function renderProgress() {
    progressEl.innerHTML = "";
    MASLOW_QUESTIONS.forEach((_, i) => {
      const item = document.createElement("div");
      item.className = "cabinet__quiz-progress-item";
      if (answers[i] !== null) item.classList.add("cabinet__quiz-progress-item--answered");
      if (i === current) item.classList.add("cabinet__quiz-progress-item--active");
      item.textContent = i + 1;
      progressEl.appendChild(item);
    });
  }

  function renderQuestion() {
    startEl.style.display = "none";
    progressEl.style.display = "";
    bodyEl.style.display = "";
    navEl.style.display = "";
    doneEl.classList.remove("cabinet__quiz-done--visible");

    const q = MASLOW_QUESTIONS[current];
    questionTextEl.textContent = q.text;
    optionsEl.innerHTML = "";

    MASLOW_OPTIONS.forEach((label, i) => {
      const optId = "maslowQ" + current + "opt" + i;
      const wrap = document.createElement("label");
      wrap.className = "cabinet__quiz-option";
      wrap.setAttribute("for", optId);

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "maslowQ" + current;
      input.id = optId;
      input.value = i;
      input.checked = answers[current] === i;
      input.addEventListener("change", function () {
        answers[current] = i;
        renderProgress();
        nextBtn.disabled = false;
      });

      const span = document.createElement("span");
      span.textContent = label;

      wrap.appendChild(input);
      wrap.appendChild(span);
      optionsEl.appendChild(wrap);
    });

    prevBtn.disabled = current === 0;
    nextBtn.disabled = answers[current] === null;
    nextBtn.textContent = current === MASLOW_QUESTIONS.length - 1 ? "Завершить тест" : "Далее";

    renderProgress();
  }

  function computeScores() {
    const totals = { safety: 0, belonging: 0, esteem: 0, selfact: 0 };
    MASLOW_QUESTIONS.forEach((q, i) => {
      const chosen = answers[i];
      if (chosen === null) return;
      const points = q.rev ? chosen + 1 : 5 - chosen; // 0-й вариант = "совершенно верно" = 5 баллов
      totals[q.cat] += points;
    });
    return totals;
  }

  function renderResults() {
    const totals = computeScores();
    lastScores = totals;
    aiStatusEl.textContent = "";
    aiStatusEl.classList.remove("cabinet__result-ai-status--error");
    aiBtn.disabled = false;
    aiBtn.textContent = "Сформировать отчёт";

    renderMaslowReport(
      { chartEl, scoresEl, breakdownEl, recommendEl, appendixEl, introId: "quizMaslowRecommendIntro" },
      totals,
      null
    );

    // Сохраняем результат в этом браузере — без ИИ-текста (он ещё не
    // запрошен). Если раньше уже был сохранён отчёт с текстом ИИ — он
    // затирается, так как ответы могли измениться при повторном прохождении.
    saveMaslowResult(totals, null);
    if (window.refreshMaslowResultsPanel) window.refreshMaslowResultsPanel();
  }

  function showDone() {
    bodyEl.style.display = "none";
    navEl.style.display = "none";
    renderResults();
    doneEl.classList.add("cabinet__quiz-done--visible");
    submitResultToServer(lastScores);
  }

  // Отправляет результат (ФИО, отдел/должность, баллы) в общую базу на
  // сервере — чтобы результат было видно в админке, а не только в этом
  // браузере. Работает "по-тихому" в фоне; если сервер ещё не настроен
  // (см. README.md) или недоступен — результат всё равно остаётся
  // сохранённым локально (см. saveMaslowResult выше), сотрудник ничего
  // не теряет.
  async function submitResultToServer(totals) {
    if (!submitStatusEl) return;
    submitStatusEl.classList.remove("cabinet__result-submit-status--error");

    if (!MASLOW_AI_WORKER_URL || !employeeName) {
      submitStatusEl.textContent = "";
      return;
    }

    submitStatusEl.textContent = "Отправляем результат ответственному лицу…";
    try {
      const resp = await fetch(MASLOW_AI_WORKER_URL + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: employeeName, department: employeeDept, scores: totals }),
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      submitStatusEl.textContent = "Результат отправлен ответственному лицу.";
    } catch (err) {
      submitStatusEl.classList.add("cabinet__result-submit-status--error");
      submitStatusEl.textContent =
        "Не удалось отправить результат в общую базу — но он сохранён в этом браузере.";
    }
  }

  async function requestAiReport() {
    if (!lastScores) return;

    if (!MASLOW_AI_WORKER_URL) {
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
      const resp = await fetch(MASLOW_AI_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: lastScores }),
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data || !data.breakdown) throw new Error("Пустой ответ");

      renderMaslowReport(
        { chartEl, scoresEl, breakdownEl, recommendEl, appendixEl, introId: "quizMaslowRecommendIntro" },
        lastScores,
        data
      );

      saveMaslowResult(lastScores, data);
      if (window.refreshMaslowResultsPanel) window.refreshMaslowResultsPanel();

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
    // Каждый раз начинаем заново с формы "как к вам обращаться" — в том
    // числе при повторном прохождении ("Пройти заново"), так как это может
    // быть уже другой сотрудник за тем же компьютером.
    employeeName = "";
    employeeDept = "";
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
    answers.fill(null);
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

  document.querySelectorAll('[data-quiz="maslow"]').forEach((trigger) => {
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
  // "Пройти заново" — снова через форму "как к вам обращаться" (мог сесть
  // другой сотрудник за тот же компьютер).
  restartBtn.addEventListener("click", openQuiz);

  prevBtn.addEventListener("click", function () {
    if (current > 0) {
      current--;
      renderQuestion();
    }
  });

  nextBtn.addEventListener("click", function () {
    if (answers[current] === null) return;
    if (current < MASLOW_QUESTIONS.length - 1) {
      current++;
      renderQuestion();
    } else {
      showDone();
    }
  });
})();
