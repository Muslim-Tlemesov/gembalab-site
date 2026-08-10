// Диагностика по 5С — экспресс-аудит рабочего пространства по методологии
// бережливого производства (Lean/Kaizen): 1С Сортировка, 2С Соблюдение
// порядка, 3С Содержание в чистоте, 4С Стандартизация, 5С Совершенствование.
// Добавлен по тому же принципу, что и остальные тесты (см. quiz-maslow.js,
// quiz-belbin.js, quiz-disc.js, quiz-situational.js): прохождение и отчёт
// внутри панели "Список тестов и анкет", результат сохраняется в этом
// браузере (localStorage) и параллельно отправляется в общую базу на
// сервере, чтобы владелец сайта видел результаты в админке (admin.html).
//
// Устройство теста (расшифровано по фотографиям веб-опросника и примеру
// итогового результата в PDF): перед началом указывается название
// оцениваемого помещения/зоны, затем 25 вопросов с ответом Да/Нет — ровно
// по 5 вопросов на каждую из 5 категорий (1С–5С). У каждого вопроса есть
// один "хороший" ответ (Да или Нет — зависит от формулировки конкретного
// вопроса, определено по смыслу каждого пункта). Балл по категории — это
// просто количество "хороших" ответов из 5 (то есть сразу шкала 0–5, без
// пересчёта в проценты — ровно как на радаре в примере PDF). Средняя оценка
// — среднее по всем 5 категориям. Для каждого вопроса с "плохим" ответом
// показывается конкретная рекомендация (для вопросов, для которых пример
// в PDF не содержал сработавшей рекомендации, рекомендация составлена по
// аналогии со стилем и духом остальных 14 официальных рекомендаций).
// Формула подтверждена на реальном примере из PDF («Murad Ali»): баллы по
// категориям 5/2/0/2/2 → среднее (5+2+0+2+2)/5 = 2.2 → округляется до
// «Средняя оценка: 2», как и указано в примере.

const FIVES_AI_WORKER_URL = "https://gembalab-maslow-report.gembalab.workers.dev";

const FIVES_SCALES = [
  { key: "sort", label: "1С (сортировка)", short: "1С" },
  { key: "order", label: "2С (соблюдение порядка)", short: "2С" },
  { key: "clean", label: "3С (содержание в чистоте)", short: "3С" },
  { key: "standardize", label: "4С (стандартизация)", short: "4С" },
  { key: "sustain", label: "5С (совершенствование)", short: "5С" },
];

const FIVES_SCALE_MAX = 5; // ровно 5 вопросов на каждую категорию

// 25 вопросов — см. пояснение в шапке файла про метод определения
// "хорошего" ответа и рекомендаций.
const FIVES_QUESTIONS = [
  {
    "text": "Есть ли ненужные или редко используемые предметы в проходах, вокруг оборудования и стеллажей?",
    "scale": "sort",
    "goodAnswer": "no",
    "recommendation": "Уберите ненужные или редко используемые предметы из проходов и рабочей зоны — оставьте только то, что действительно нужно для работы."
  },
  {
    "text": "Есть ли лишние запасы входящих материалов и сырья на рабочем месте (не рассчитано точное количество запасов)?",
    "scale": "sort",
    "goodAnswer": "no",
    "recommendation": "Рассчитайте и зафиксируйте точное необходимое количество материалов и сырья на рабочем месте — уберите лишние запасы."
  },
  {
    "text": "Есть ли ненужные и редко используемые (которые не используются ежедневно) вещи/предметы на стеллажах, рабочих столах и ящиках?",
    "scale": "sort",
    "goodAnswer": "no",
    "recommendation": "Проведите сортировку стеллажей, рабочих столов и ящиков — уберите или утилизируйте ненужные и редко используемые вещи."
  },
  {
    "text": "Есть ли на участке ненужные предметы и оборудование (которые не используются ежедневно)?",
    "scale": "sort",
    "goodAnswer": "no",
    "recommendation": "Определите и вынесите с участка ненужное оборудование и предметы, которые не используются ежедневно."
  },
  {
    "text": "Имеется ли карантинная зона (есть обозначение/надпись и выделена зона)?",
    "scale": "sort",
    "goodAnswer": "yes",
    "recommendation": "Организуйте карантинную зону с чёткой надписью и обозначением — временное место для предметов, в необходимости которых вы не уверены, прежде чем принять решение об их дальнейшей судьбе."
  },
  {
    "text": "Обозначены ли разграничительными линиями проходы и места хранения материалов (есть четкая схема/навигация рабочих мест и мест хранения, есть расшифровка цветовых линий, если они нанесены)?",
    "note": "т.е. есть ли четкий адрес или визуализация мест хранения",
    "scale": "order",
    "goodAnswer": "yes",
    "recommendation": "Нанесите разграничительные линии для проходов и мест хранения материалов и добавьте расшифровку цветовых обозначений."
  },
  {
    "text": "Есть ли обозначения/визуализация того, что должно храниться в определенных местах (есть фото и надпись на местах, где и что лежит)?",
    "scale": "order",
    "goodAnswer": "yes",
    "recommendation": "Добавьте таблички, фото или подписи на местах хранения — что именно должно там находиться."
  },
  {
    "text": "Есть ли предметы, материалы, которые находятся не в определенных местах (предметы лежат не на своем месте или на необозначенном месте)?",
    "scale": "order",
    "goodAnswer": "no",
    "recommendation": "Вернуть предметы/материалы на свои места и определить им адрес хранения в случае отсутствия места."
  },
  {
    "text": "Есть ли разделение мусора по видам (есть специально отведенное/обозначенное место для сортировки мусора и сортировка соблюдается)?",
    "scale": "order",
    "goodAnswer": "yes",
    "recommendation": "Организуйте по мере возможности разделение мусора по видам: бумага, пластик, стекло, металл и т.п."
  },
  {
    "text": "Сможет ли сотрудник найти нужный предмет, обнаружить недостачу и понять, что предмет лежит не на своем месте в пределах 10 секунд?",
    "scale": "order",
    "goodAnswer": "yes",
    "recommendation": "Сделайте удобным для Вас способом обозначение проходов и мест хранения материалов, чтобы было понятно даже незнакомому лицу."
  },
  {
    "text": "Есть ли на полу, в проходах, на рабочих столах, мебели и в рабочей зоне мусор, пыль, следы загрязнения (нет графика уборки или график уборки есть, но он не соблюдается)?",
    "scale": "clean",
    "goodAnswer": "no",
    "recommendation": "Убрать от загрязнений пол, проходы, рабочий стол и определить график уборки."
  },
  {
    "text": "Есть ли загрязнения оборудования, инструментов и оснастки, рабочих столов и стеллажей (нет графика уборки с ответственными лицами или он есть, но не соблюдается)?",
    "scale": "clean",
    "goodAnswer": "no",
    "recommendation": "Убрать от загрязнений оборудование, инструменты, оснастку, рабочие столы, стеллажи, определив график уборки и выделив инвентарь для уборки."
  },
  {
    "text": "Чистые (нет загрязнений и пыли) ли окна, стены, двери, места отдыха и т.д. (есть график уборки с ответственными лицами и он соблюдается)?",
    "scale": "clean",
    "goodAnswer": "yes",
    "recommendation": "Отмойте от загрязнения окна, двери, стены, места отдыха и т.д., определив график уборки и ответственных."
  },
  {
    "text": "Есть ли на полу проводка и т.п. (проводка весит как попало или лежит на полу и не закреплена аккуратно)?",
    "note": "т.е. кабели, шнуры, провода висят или лежат как попало (не собраны)",
    "scale": "clean",
    "goodAnswer": "no",
    "recommendation": "Закрепите и уложите аккуратно провода и все то, за что можно зацепиться/споткнуться на полу."
  },
  {
    "text": "Назначен ли ответственный за каждой зоной/оборудованием (имеется фотография, ФИО ответственного и время ухода)?",
    "scale": "clean",
    "goodAnswer": "yes",
    "recommendation": "Определить ответственность за каждой зоной/оборудованием, чтобы не осталось пространства, у которого нет хозяина."
  },
  {
    "text": "Легко ли поменять места размещения предметов, материалов и сырья и т.д.?",
    "note": "т.е. шкафчики, столы, оборудование можно без усилий передвинуть (имеют колесики)",
    "scale": "standardize",
    "goodAnswer": "yes",
    "recommendation": "Предусмотреть возможность легкого изменения размещения предметов/материалов/сырья. Не делайте хранение предметов капитальным, предусмотрите возможность легкой транспортировки."
  },
  {
    "text": "Является ли визуализация (ярлыки и т.д.) материалов и сырья легко понятной (третье лицо разберется без подсказки)?",
    "scale": "standardize",
    "goodAnswer": "yes",
    "recommendation": "Сделайте визуализацию материалов и сырья понятной постороннему человеку — используйте ярлыки, фото и понятные подписи, а не внутренние обозначения."
  },
  {
    "text": "Есть ли стандарты по 3С на рабочих местах (есть утвержденные правила организации рабочего места)?",
    "note": "т.е. есть ли график уборки или правила уборки, принятые персоналом, места хранения, обозначение предметов и фотография рабочего места как должно быть",
    "scale": "standardize",
    "goodAnswer": "yes",
    "recommendation": "Чтобы закрепить сортировку, организацию порядка и формирование чистоты на рабочем месте, оформите правила или стандарт, по которому можно выявить отклонение и улучшать в дальнейшем."
  },
  {
    "text": "Ведутся ли постоянные комплексные мероприятия по поддержанию 3С (есть лист контроля, план действий и он соблюдается)?",
    "scale": "standardize",
    "goodAnswer": "yes",
    "recommendation": "Определить причины и что требуется сделать в ближайшее время для поддержания 3С."
  },
  {
    "text": "Определены ли зоны расположения изделия на рабочем месте в процессе выполнения операций и по завершению (есть четко обозначенные места, куда кладутся предметы во время и после работы)?",
    "scale": "standardize",
    "goodAnswer": "yes",
    "recommendation": "Определите и обозначьте зоны расположения изделия во время и после выполнения операций — чтобы каждый предмет имел понятное место в процессе работы."
  },
  {
    "text": "Определены ли правила по соблюдению 5С (есть регламент/положение и приказ по 5С, который регулярно контролируется)?",
    "scale": "sustain",
    "goodAnswer": "yes",
    "recommendation": "Оформить письменно правила по соблюдению правил 5С и разместить на видном для всех месте."
  },
  {
    "text": "Проводится ли регулярное обслуживание оборудования по принципам 4С (есть журнал ухода, он соблюдается, также регулярно проверяется сотрудниками и руководством)?",
    "scale": "sustain",
    "goodAnswer": "yes",
    "recommendation": "Определить письменные правила по регулярному обслуживанию оборудования и оформить стандарт по принципам 4С."
  },
  {
    "text": "Принимаются ли меры по недопущению повторения отклонений от норм 5С?",
    "scale": "sustain",
    "goodAnswer": "yes",
    "recommendation": "Введите регулярный анализ причин отклонений от норм 5С и конкретные меры, чтобы они не повторялись."
  },
  {
    "text": "Является ли участок местом, где легко работать (легко найти предметы, чисто, удобно, освещено и комфортно)?",
    "scale": "sustain",
    "goodAnswer": "yes",
    "recommendation": "Проанализируйте, что мешает сотрудникам удобно работать на участке (освещение, эргономика, доступность предметов), и устраните эти препятствия."
  },
  {
    "text": "Есть ли система поощрений рабочих мест с высоким уровнем техники безопасности (доска почета/грамоты/конкурс, внимание со стороны руководителей)?",
    "scale": "sustain",
    "goodAnswer": "yes",
    "recommendation": "Продумать конкурс за лучшее пространство, материальное или нематериальное поощрение для рабочих мест с высоким уровнем техники безопасности и стремления соблюдать стандарты 5С. Фиксировать на видном месте результаты оценки рабочего пространства."
  }
];

// Балл по категории 0–5, без пересчёта в проценты (проверено на примере из
// PDF — см. шапку файла). "Внимание" — когда балл 0–2, это подсвечивается
// красным (как и другие "заметные" значения на сайте), так как именно эти
// категории нуждаются в первоочередных действиях.
function fivesTier(score) {
  if (score <= 2) return "attention";
  if (score <= 3) return "medium";
  return "good";
}

function fivesTierLabel(tier) {
  if (tier === "attention") return "требует внимания";
  if (tier === "medium") return "есть над чем поработать";
  return "в порядке";
}

function fivesFormatAverage(avg) {
  return avg.toFixed(1).replace(".", ",");
}

const FIVES_STORAGE_KEY = "gembalab_5s_result_v1";

function save5sResult(spaceName, totals, aiData) {
  try {
    localStorage.setItem(
      FIVES_STORAGE_KEY,
      JSON.stringify({ spaceName: spaceName || "", totals: totals, ai: aiData || null, savedAt: Date.now() })
    );
  } catch (e) {}
}

function load5sResult() {
  try {
    const raw = localStorage.getItem(FIVES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clear5sResult() {
  try {
    localStorage.removeItem(FIVES_STORAGE_KEY);
  } catch (e) {}
}

// Радар-график (пятиугольник) 0–5 по пяти категориям — как в примере отчёта
// (PDF). Рисуется инлайновым SVG, чтобы не тянуть внешние библиотеки.
function fives5RadarSvg(totals) {
  const W = 360;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2 - 6;
  const R = 118;
  const maxV = 5;
  const n = FIVES_SCALES.length;

  function pointFor(i, value) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (Math.max(0, Math.min(maxV, value)) / maxV) * R;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function labelPointFor(i) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = R + 34;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  // Сетка — 5 вложенных пятиугольников (уровни 1..5)
  const gridLevels = [1, 2, 3, 4, 5];
  const gridPolys = gridLevels
    .map((level) => {
      const pts = FIVES_SCALES.map((_, i) => {
        const p = pointFor(i, level);
        return p.x.toFixed(1) + "," + p.y.toFixed(1);
      }).join(" ");
      const strong = level === 5;
      return '<polygon points="' + pts + '" fill="none" stroke="' + (strong ? "#c7cbd3" : "#e4e6ea") + '" stroke-width="1" />';
    })
    .join("");

  // Оси — линии от центра к каждой вершине внешнего пятиугольника
  const axisLines = FIVES_SCALES.map((_, i) => {
    const p = pointFor(i, maxV);
    return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="#e4e6ea" stroke-width="1" />';
  }).join("");

  // Значения сотрудника — заполненный пятиугольник
  const valuePts = FIVES_SCALES.map((s, i) => {
    const p = pointFor(i, totals[s.key] || 0);
    return p.x.toFixed(1) + "," + p.y.toFixed(1);
  }).join(" ");

  const valueDots = FIVES_SCALES.map((s, i) => {
    const p = pointFor(i, totals[s.key] || 0);
    return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="#e9152b" />';
  }).join("");

  const labels = FIVES_SCALES.map((s, i) => {
    const p = labelPointFor(i);
    const anchor = Math.abs(p.x - cx) < 8 ? "middle" : p.x > cx ? "start" : "end";
    return (
      '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) +
      '" font-size="13" font-weight="700" fill="#394155" text-anchor="' + anchor + '">' + s.short + "</text>"
    );
  }).join("");

  const padX = 20;
  const padY = 18;
  return (
    '<svg viewBox="' + -padX + " " + -padY + " " + (W + 2 * padX) + " " + (H + 2 * padY) + '" class="cabinet__disc-chart-svg" role="img" aria-label="Радар 5С">' +
    gridPolys +
    axisLines +
    '<polygon points="' + valuePts + '" fill="rgba(233,21,43,0.18)" stroke="#e9152b" stroke-width="2" />' +
    valueDots +
    labels +
    "</svg>"
  );
}

// Список рекомендаций — сгруппирован по категориям (как таблица в PDF),
// показываются только пункты с "плохим" ответом. Если в категории всё
// хорошо (5 из 5) — категория просто не появляется в списке.
function fives5RecommendationsHtml(answers) {
  const groups = FIVES_SCALES.map((s) => ({ scale: s, items: [] }));
  const byKey = {};
  groups.forEach((g) => (byKey[g.scale.key] = g));

  FIVES_QUESTIONS.forEach((q, i) => {
    const a = answers[i];
    if (a == null || a === q.goodAnswer) return;
    byKey[q.scale].items.push(q.recommendation);
  });

  const nonEmpty = groups.filter((g) => g.items.length > 0);
  if (!nonEmpty.length) {
    return '<p class="cabinet__placeholder">Замечаний нет — по всем 25 пунктам ответы соответствуют норме 5С. Отличный результат!</p>';
  }

  return nonEmpty
    .map((g) => {
      const items = g.items.map((text) => "<li>" + text + "</li>").join("");
      return (
        '<div class="cabinet__result-recommend-group">' +
        '<div class="cabinet__result-recommend-title">' + g.scale.label + "</div>" +
        "<ul>" + items + "</ul>" +
        "</div>"
      );
    })
    .join("");
}

// Общая отрисовка отчёта (радар + баллы по категориям + рекомендации) —
// используется и на экране результатов внутри самого теста, и в разделе
// "Результаты" личного кабинета, и в админке. Если передан aiData —
// добавляется персональный текст ИИ (общая оценка + план действий) поверх
// стандартного списка рекомендаций.
function render5sReport(els, spaceName, totals, answers, aiData) {
  const results = FIVES_SCALES.map((s) => {
    const score = totals[s.key] || 0;
    return { ...s, score, tier: fivesTier(score) };
  });
  const average = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  if (els.spaceEl) {
    els.spaceEl.textContent = spaceName ? "Оцениваемое помещение: " + spaceName : "";
  }
  if (els.averageEl) {
    els.averageEl.textContent = "Средняя оценка: " + fivesFormatAverage(average) + " из 5";
  }

  els.chartEl.innerHTML = fives5RadarSvg(totals);

  els.scoresEl.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    const tierSpan =
      '<span class="cabinet__result-tier' +
      (r.tier === "attention" ? " cabinet__result-tier--high" : "") +
      '">' + fivesTierLabel(r.tier) + "</span>";
    li.innerHTML = "<span>" + r.label + "</span><span>" + r.score + " из 5 · " + tierSpan + "</span>";
    els.scoresEl.appendChild(li);
  });

  if (aiData && aiData.action_plan) {
    els.recommendEl.innerHTML = "";
    const intro = document.createElement("p");
    intro.className = "cabinet__result-item-text";
    intro.style.marginBottom = "18px";
    intro.textContent = aiData.action_plan;
    els.recommendEl.appendChild(intro);

    if (aiData.breakdown) {
      results.forEach((r) => {
        const text = aiData.breakdown[r.key];
        if (!text) return;
        const item = document.createElement("div");
        item.className = "cabinet__result-item cabinet__result-item--ai";
        const title = document.createElement("div");
        title.className = "cabinet__result-item-title";
        title.textContent = r.label + " (" + r.score + " из 5)";
        const p = document.createElement("p");
        p.className = "cabinet__result-item-text";
        p.textContent = text;
        item.appendChild(title);
        item.appendChild(p);
        els.recommendEl.appendChild(item);
      });
    }

    const listTitle = document.createElement("h4");
    listTitle.className = "cabinet__section-title";
    listTitle.textContent = "Полный список замечаний по пунктам";
    els.recommendEl.appendChild(listTitle);
    const listWrap = document.createElement("div");
    listWrap.innerHTML = fives5RecommendationsHtml(answers);
    els.recommendEl.appendChild(listWrap);
  } else {
    els.recommendEl.innerHTML = fives5RecommendationsHtml(answers);
  }

  return results;
}

// Раздел "Результаты" личного кабинета — свой блок среди блоков остальных
// тестов, читает сохранённый результат из localStorage.
(function () {
  const emptyEl = document.getElementById("fivesResultsEmpty");
  const filledEl = document.getElementById("fivesResultsFilled");
  if (!emptyEl || !filledEl) return;

  const dateEl = document.getElementById("fivesResultsDate");
  const clearBtn = document.getElementById("fivesResultsClear");
  const resultsEls = {
    spaceEl: document.getElementById("fivesResultsSpace"),
    averageEl: document.getElementById("fivesResultsAverage"),
    chartEl: document.getElementById("fivesResultsChart"),
    scoresEl: document.getElementById("fivesResultsScores"),
    recommendEl: document.getElementById("fivesResultsRecommend"),
  };

  window.refreshFivesResultsPanel = function () {
    const saved = load5sResult();
    if (!saved || !saved.totals) {
      emptyEl.style.display = "";
      filledEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";
    filledEl.style.display = "";
    render5sReport(resultsEls, saved.spaceName, saved.totals, saved.answers || [], saved.ai);
    if (dateEl) {
      const d = saved.savedAt ? new Date(saved.savedAt) : null;
      dateEl.textContent = d
        ? "Сохранено: " + d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "";
    }
  };

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Удалить сохранённый результат диагностики по 5С?")) return;
      clear5sResult();
      window.refreshFivesResultsPanel();
    });
  }

  window.refreshFivesResultsPanel();
})();

(function () {
  const listView = document.getElementById("testsListView");
  const quiz = document.getElementById("quiz5s");
  if (!listView || !quiz) return;

  const progressEl = document.getElementById("quiz5sProgress");
  const questionTextEl = document.getElementById("quiz5sQuestionText");
  const questionNoteEl = document.getElementById("quiz5sQuestionNote");
  const optionsEl = document.getElementById("quiz5sOptions");
  const prevBtn = document.getElementById("quiz5sPrev");
  const nextBtn = document.getElementById("quiz5sNext");
  const backBtn = document.getElementById("quiz5sBack");
  const restartBtn = document.getElementById("quiz5sRestart");
  const bodyEl = document.getElementById("quiz5sBody");
  const navEl = quiz.querySelector(".cabinet__quiz-nav");
  const doneEl = document.getElementById("quiz5sDone");

  const spaceEl = document.getElementById("quiz5sSpace");
  const averageEl = document.getElementById("quiz5sAverage");
  const chartEl = document.getElementById("quiz5sChart");
  const scoresEl = document.getElementById("quiz5sScores");
  const recommendEl = document.getElementById("quiz5sRecommend");
  const aiBtn = document.getElementById("quiz5sAiBtn");
  const aiStatusEl = document.getElementById("quiz5sAiStatus");
  const submitStatusEl = document.getElementById("quiz5sSubmitStatus");

  const startEl = document.getElementById("quiz5sStart");
  const nameInput = document.getElementById("quiz5sName");
  const deptInput = document.getElementById("quiz5sDept");
  const spaceInput = document.getElementById("quiz5sSpaceInput");
  const startErrorEl = document.getElementById("quiz5sStartError");

  const answers = new Array(FIVES_QUESTIONS.length).fill(null);
  let current = 0;
  let lastScores = null;
  let employeeName = "";
  let employeeDept = "";
  let spaceName = "";
  let lastSubmissionId = null;

  function renderProgress() {
    progressEl.innerHTML = "";
    FIVES_QUESTIONS.forEach((_, i) => {
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

    const q = FIVES_QUESTIONS[current];
    questionTextEl.textContent = q.text;
    if (questionNoteEl) {
      questionNoteEl.textContent = q.note || "";
      questionNoteEl.style.display = q.note ? "" : "none";
    }
    optionsEl.innerHTML = "";

    [
      { value: "yes", label: "Да" },
      { value: "no", label: "Нет" },
    ].forEach((opt) => {
      const optId = "fivesQ" + current + "opt" + opt.value;
      const wrap = document.createElement("label");
      wrap.className = "cabinet__quiz-option";
      wrap.setAttribute("for", optId);

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "fivesQ" + current;
      input.id = optId;
      input.value = opt.value;
      input.checked = answers[current] === opt.value;
      input.addEventListener("change", function () {
        answers[current] = opt.value;
        renderProgress();
        nextBtn.disabled = false;
      });

      const span = document.createElement("span");
      span.textContent = opt.label;

      wrap.appendChild(input);
      wrap.appendChild(span);
      optionsEl.appendChild(wrap);
    });

    prevBtn.disabled = current === 0;
    nextBtn.disabled = answers[current] === null;
    nextBtn.textContent = current === FIVES_QUESTIONS.length - 1 ? "Завершить тест" : "Далее";

    renderProgress();
  }

  function computeScores() {
    const totals = {};
    FIVES_SCALES.forEach((s) => (totals[s.key] = 0));
    FIVES_QUESTIONS.forEach((q, i) => {
      const chosen = answers[i];
      if (chosen === null) return;
      if (chosen === q.goodAnswer) totals[q.scale] += 1;
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

    render5sReport({ spaceEl: spaceEl, averageEl: averageEl, chartEl: chartEl, scoresEl: scoresEl, recommendEl: recommendEl }, spaceName, totals, answers, null);

    save5sResult(spaceName, totals, null);
    // answers сохраняем отдельно от save5sResult (та функция задаёт только
    // totals/ai) — дописываем сразу в тот же объект localStorage.
    try {
      const raw = localStorage.getItem(FIVES_STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj.answers = answers.slice();
      localStorage.setItem(FIVES_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}

    if (window.refreshFivesResultsPanel) window.refreshFivesResultsPanel();
  }

  function showDone() {
    bodyEl.style.display = "none";
    navEl.style.display = "none";
    renderResults();
    doneEl.classList.add("cabinet__quiz-done--visible");
    submitResultToServer(lastScores);
  }

  async function submitResultToServer(totals) {
    lastSubmissionId = null;
    if (!submitStatusEl) return;
    submitStatusEl.classList.remove("cabinet__result-submit-status--error");

    if (!FIVES_AI_WORKER_URL || !employeeName) {
      submitStatusEl.textContent = "";
      return;
    }

    submitStatusEl.textContent = "Отправляем результат ответственному лицу…";
    try {
      const resp = await fetch(FIVES_AI_WORKER_URL + "/5s/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: employeeName,
          department: employeeDept,
          space: spaceName,
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
    if (!FIVES_AI_WORKER_URL || !lastSubmissionId) return;
    try {
      await fetch(FIVES_AI_WORKER_URL + "/5s/submit/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lastSubmissionId,
          breakdown: data.breakdown,
          action_plan: data.action_plan,
        }),
      });
    } catch (err) {}
  }

  async function requestAiReport() {
    if (!lastScores) return;

    if (!FIVES_AI_WORKER_URL) {
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
      const failedItems = [];
      FIVES_QUESTIONS.forEach((q, i) => {
        if (answers[i] != null && answers[i] !== q.goodAnswer) failedItems.push(q.recommendation);
      });

      const resp = await fetch(FIVES_AI_WORKER_URL + "/5s", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores: lastScores, space: spaceName, failedItems: failedItems }),
      });

      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (!data || !data.action_plan) throw new Error("Пустой ответ");

      render5sReport({ spaceEl: spaceEl, averageEl: averageEl, chartEl: chartEl, scoresEl: scoresEl, recommendEl: recommendEl }, spaceName, lastScores, answers, data);

      save5sResult(spaceName, lastScores, data);
      try {
        const raw = localStorage.getItem(FIVES_STORAGE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        obj.answers = answers.slice();
        localStorage.setItem(FIVES_STORAGE_KEY, JSON.stringify(obj));
      } catch (e) {}
      if (window.refreshFivesResultsPanel) window.refreshFivesResultsPanel();
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
    spaceName = "";
    lastSubmissionId = null;
    if (nameInput) nameInput.value = "";
    if (deptInput) deptInput.value = "";
    if (spaceInput) spaceInput.value = "";
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
    const space = spaceInput ? spaceInput.value.trim() : "";
    if (!name) {
      if (startErrorEl) {
        startErrorEl.textContent = "Пожалуйста, укажите ФИО.";
        startErrorEl.style.display = "";
      }
      return;
    }
    if (!space) {
      if (startErrorEl) {
        startErrorEl.textContent = "Пожалуйста, укажите название помещения, которое будете оценивать.";
        startErrorEl.style.display = "";
      }
      return;
    }
    employeeName = name;
    employeeDept = deptInput ? deptInput.value.trim() : "";
    spaceName = space;

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

  document.querySelectorAll('[data-quiz="5s"]').forEach((trigger) => {
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
    if (answers[current] === null) return;
    if (current < FIVES_QUESTIONS.length - 1) {
      current++;
      renderQuestion();
    } else {
      showDone();
    }
  });
})();
