// Cloudflare Worker для сайта GEMBALAB — один сервер на три теста
// (Маслоу, Белбин, DISC), у каждого свой набор функций:
//
// Тест Маслоу:
//  1) POST /            — персональный текст по результатам через ИИ.
//  2) POST /submit       — сотрудник отправляет результат (ФИО, отдел,
//                          баллы, ответы) в общую базу данных (D1).
//  3) POST /submit/ai    — дописывает в ту же запись текст ИИ.
//  4) POST /admin/list   — по паролю отдаёт список результатов для admin.html.
//  5) POST /admin/delete — по паролю удаляет одну запись.
//
// Тест Белбина (командные роли, 8 ролей, очки распределяются по 7 вопросам):
//  6) POST /belbin              — персональный текст по ведущим ролям через ИИ.
//  7) POST /belbin/submit       — сотрудник отправляет результат в базу.
//  8) POST /belbin/submit/ai    — дописывает текст ИИ в ту же запись.
//  9) POST /admin/belbin/list   — по паролю отдаёт список результатов Белбина.
// 10) POST /admin/belbin/delete — по паролю удаляет одну запись Белбина.
//
// Тест DISC (поведенческий стиль D/I/S/C, 28 блоков "больше/меньше всего"):
// 11) POST /disc              — персональный текст по баллам D/I/S/C через ИИ.
// 12) POST /disc/submit       — сотрудник отправляет результат в базу.
// 13) POST /disc/submit/ai    — дописывает текст ИИ в ту же запись.
// 14) POST /admin/disc/list   — по паролю отдаёт список результатов DISC.
// 15) POST /admin/disc/delete — по паролю удаляет одну запись DISC.
//
// Всё бесплатно: Workers AI (10 000 "нейронов"/день) и D1 (5 ГБ, 100 000
// записей/день) не требуют банковской карты на бесплатном тарифе.
//
// Настройка (см. README.md в этой же папке):
//   1) npm install -g wrangler
//   2) wrangler login
//   3) поправить ALLOWED_ORIGIN в wrangler.toml на адрес твоего GitHub Pages
//   4) wrangler d1 create ... , создать таблицы, wrangler secret put ADMIN_PASSWORD
//   5) wrangler deploy

const CATEGORY_LABELS = {
  safety: "Потребность в безопасности",
  belonging: "Потребность в принадлежности к обществу",
  esteem: "Потребность в уважении и признании",
  selfact: "Потребность в самореализации",
};

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    breakdown: {
      type: "object",
      properties: {
        safety: { type: "string" },
        belonging: { type: "string" },
        esteem: { type: "string" },
        selfact: { type: "string" },
      },
      required: ["safety", "belonging", "esteem", "selfact"],
    },
    recommendations_intro: { type: "string" },
  },
  required: ["breakdown", "recommendations_intro"],
};

function tierLabel(score) {
  if (score >= 18) return "высокая";
  if (score >= 11) return "средняя";
  return "низкая";
}

function corsHeaders(allowedOrigin, requestOrigin) {
  const origin =
    allowedOrigin === "*" || !allowedOrigin
      ? "*"
      : allowedOrigin === requestOrigin
      ? requestOrigin
      : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function validScores(scores) {
  return (
    scores &&
    typeof scores.safety === "number" &&
    typeof scores.belonging === "number" &&
    typeof scores.esteem === "number" &&
    typeof scores.selfact === "number"
  );
}

// POST / — персональный ИИ-текст по баллам (существующая функция, без изменений).
async function handleReport(request, env, headers) {
  if (!env.AI) {
    return json({ error: "AI binding is not configured — проверь [ai] в wrangler.toml" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const scores = body && body.scores;
  const name = body && typeof body.name === "string" ? body.name.slice(0, 60) : "";

  if (!validScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  const scoreLines = Object.keys(CATEGORY_LABELS)
    .map((key) => `${CATEGORY_LABELS[key]}: ${scores[key]} из 25 баллов (уровень: ${tierLabel(scores[key])})`)
    .join("\n");

  const prompt = `Ты — консультант по мотивации персонала. Человек прошёл рабочую адаптацию теста Маслоу (4 потребности, максимум 25 баллов в каждой).

Баллы человека${name ? ` (${name})` : ""}:
${scoreLines}

Заполни JSON-объект со следующими полями:
- breakdown.safety, breakdown.belonging, breakdown.esteem, breakdown.selfact — по 2-3 живых предложения от второго лица на русском языке: что этот балл говорит о человеке, как это проявляется в жизни и на работе, почему это важно именно с таким уровнем.
- recommendations_intro — 2-3 предложения персонального совета, который опирается именно на сочетание этих четырёх баллов у этого человека: какие потребности сильные, какие стоит подтянуть, и как это выглядит именно у него.

Пиши строго на русском языке, тёплым, но деловым тоном, без канцелярита, без списков и форматирования внутри текста — только связные предложения. Каждое слово должно быть русским: не используй слова и вставки из английского, украинского, сербского, хорватского или любого другого языка ни в исходной, ни в изменённой форме (например, недопустимы слова вроде "combinacija", "kombinacija" и подобные).`;

  const model = env.MODEL || "@cf/meta/llama-3.1-8b-instruct-fast";

  let aiResponse;
  try {
    aiResponse = await env.AI.run(model, {
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: REPORT_SCHEMA,
      },
      // По умолчанию модель обрезает ответ на 256 "токенах" — этого не
      // хватает на текст по всем 4 категориям + вступление, ответ обрывался
      // на середине и не читался как JSON. Увеличиваем запас.
      max_tokens: 1500,
    });
  } catch (e) {
    return json({ error: "Workers AI request failed", details: String(e) }, 502, headers);
  }

  // response обычно уже разобранный объект (json_schema mode), но на
  // всякий случай поддерживаем и вариант, когда пришла JSON-строка.
  let parsed = aiResponse && aiResponse.response;
  if (typeof parsed === "string") {
    try {
      const jsonMatch = parsed.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : parsed);
    } catch (e) {
      return json({ error: "Could not parse AI response", raw: parsed }, 502, headers);
    }
  }

  if (!parsed || !parsed.breakdown) {
    return json({ error: "Empty AI response", raw: aiResponse }, 502, headers);
  }

  return json(parsed, 200, headers);
}

// POST /submit — сотрудник отправляет свой результат (баллы + ответы по
// каждому вопросу) в общую базу (D1), чтобы владелец сайта видел полную
// картину в админке, а не только в своём браузере. Возвращает id записи —
// он понадобится, если позже (после "Сформировать отчёт") нужно будет
// дописать в эту же запись текст ИИ (см. handleSubmitAi ниже).
async function handleSubmit(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const name = body && typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  const department = body && typeof body.department === "string" ? body.department.trim().slice(0, 150) : "";
  const scores = body && body.scores;
  const answers = body && Array.isArray(body.answers) ? body.answers : null;

  if (!name) {
    return json({ error: "Missing name" }, 400, headers);
  }
  if (!validScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  let insertId;
  try {
    const result = await env.DB.prepare(
      "INSERT INTO submissions (full_name, department, safety, belonging, esteem, selfact, answers, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        name,
        department,
        scores.safety,
        scores.belonging,
        scores.esteem,
        scores.selfact,
        answers ? JSON.stringify(answers) : null,
        new Date().toISOString()
      )
      .run();
    insertId = result && result.meta && result.meta.last_row_id;
  } catch (e) {
    return json({ error: "DB insert failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, id: insertId }, 200, headers);
}

// POST /submit/ai — дописывает в уже существующую запись (по id, который
// вернул /submit) персональный текст ИИ, если сотрудник нажал "Сформировать
// отчёт". Не создаёт новую запись — только обновляет существующую.
async function handleSubmitAi(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const id = body && body.id;
  const breakdown = body && body.breakdown;
  const recommendationsIntro =
    body && typeof body.recommendations_intro === "string" ? body.recommendations_intro : "";

  if (!id || !breakdown) {
    return json({ error: "Missing id or breakdown" }, 400, headers);
  }

  try {
    await env.DB.prepare("UPDATE submissions SET ai_breakdown = ?, ai_recommendations = ? WHERE id = ?")
      .bind(JSON.stringify(breakdown), recommendationsIntro, id)
      .run();
  } catch (e) {
    return json({ error: "DB update failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

// ===== Тест Белбина (командные роли) =====

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

// Краткие справочные описания ролей — контекст для ИИ, чтобы текст
// опирался на реальную характеристику роли, а не выдумывал её с нуля.
const BELBIN_ROLE_INFO = {
  coordinator:
    "Зрелый, уверенный, охотно раздаёт поручения и мудро использует таланты каждого для целей команды. Хорошо проявляет себя во главе людей с разными навыками, действует девизом «консультация с контролем».",
  generator:
    "Инноватор и изобретатель, сеет идеи, из которых прорастают проекты. Предпочитает работать самостоятельно, используя воображение. Независим и оригинален, но может быть слабым в общении с людьми другого уровня.",
  tvorets:
    "Высокий уровень мотивации, неисчерпаемая энергия и жажда достижений. Экстраверт, напорист, бросает вызов, ведёт других и подталкивает к действиям. Целеустремлён, но иногда не хватает человеческого понимания.",
  issledovatel:
    "Энтузиаст и яркий экстраверт, рождён для переговоров, поиска новых возможностей и налаживания контактов. Легко подхватывает и развивает чужие идеи. Без внешней стимуляции энтузиазм быстро снижается.",
  ekspert:
    "Серьёзный и предусмотрительный, с иммунитетом против чрезмерного энтузиазма. Медлителен в решениях, предпочитает всё обдумать, критически мыслит и редко ошибается в суждениях.",
  diplomat:
    "Пользуется наибольшей поддержкой команды: вежлив, гибок, адаптируется к людям и ситуациям. Умеет слушать и сопереживать, предотвращает межличностные трения — «смазка» команды.",
  realizator:
    "Практический здравый смысл, самоконтроль и дисциплина. Любит системную работу, верен ценностям компании, делает то, что нужно делу, а не только то, что нравится.",
  ispolnitel:
    "Огромная способность доводить дело до завершения, внимание к деталям. Мотивируется внутренним беспокойством, не терпит случайностей, не склонен делегировать — незаменим там, где нужна точность и сроки.",
};

const BELBIN_REPORT_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          text: { type: "string" },
        },
        required: ["role", "text"],
      },
    },
  },
  required: ["intro", "roles"],
};

function validBelbinScores(scores) {
  if (!scores) return false;
  return BELBIN_ROLE_ORDER.every((k) => typeof scores[k] === "number");
}

function belbinTopRoles(scores) {
  const ranked = BELBIN_ROLE_ORDER.map((key) => ({ key, label: BELBIN_ROLE_LABELS[key], score: scores[key] })).sort(
    (a, b) => b.score - a.score
  );
  // Обычно берём топ-2 (ведущая + дополнительная роль), но если третья роль
  // набрала столько же баллов, что и вторая — включаем и её, чтобы не
  // отбрасывать явную "тройную" ничью произвольно.
  let count = 2;
  if (ranked[2] && ranked[1] && ranked[2].score === ranked[1].score) count = 3;
  return ranked.slice(0, count);
}

// POST /belbin — персональный ИИ-текст по 2-3 ведущим ролям.
async function handleBelbinReport(request, env, headers) {
  if (!env.AI) {
    return json({ error: "AI binding is not configured — проверь [ai] в wrangler.toml" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const scores = body && body.scores;
  const name = body && typeof body.name === "string" ? body.name.slice(0, 60) : "";

  if (!validBelbinScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  const scoreLines = BELBIN_ROLE_ORDER.map((key) => `${BELBIN_ROLE_LABELS[key]}: ${scores[key]} из 70 баллов`).join(
    "\n"
  );
  const top = belbinTopRoles(scores);
  const topLabels = top.map((t) => t.label).join(", ");
  const topInfo = top.map((t) => `${t.label}: ${BELBIN_ROLE_INFO[t.key]}`).join("\n\n");

  const prompt = `Ты — консультант по командным ролям (модель Р.М. Белбина). Человек прошёл тест из 7 вопросов, в каждом распределил 10 баллов между вариантами ответа, каждый вариант соответствует одной из 8 командных ролей (максимум 70 баллов на роль).

Баллы человека${name ? ` (${name})` : ""} по всем ролям:
${scoreLines}

Его ведущие роли (по итогам теста): ${topLabels}.

Справочные описания этих ролей (используй как основу, не копируй дословно):
${topInfo}

Заполни JSON-объект:
- intro — 2-3 предложения: краткое персональное вступление о том, какие роли ведущие у этого человека и что это в целом значит для его работы в команде.
- roles — массив из ${top.length} объектов, ровно по одному на каждую из ведущих ролей в этом порядке: ${topLabels}. У каждого объекта: role — точное название роли (как указано выше), text — 2-3 живых предложения от второго лица о том, как эта роль проявляется у этого человека в реальной работе и командном взаимодействии, с опорой на баллы и справочное описание.

Пиши строго на русском языке, тёплым, но деловым тоном, без канцелярита, без списков и форматирования внутри текста — только связные предложения. Каждое слово должно быть русским: не используй слова и вставки из английского, украинского, сербского, хорватского или любого другого языка ни в исходной, ни в изменённой форме.`;

  const model = env.MODEL || "@cf/meta/llama-3.1-8b-instruct-fast";

  let aiResponse;
  try {
    aiResponse = await env.AI.run(model, {
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: BELBIN_REPORT_SCHEMA,
      },
      max_tokens: 1500,
    });
  } catch (e) {
    return json({ error: "Workers AI request failed", details: String(e) }, 502, headers);
  }

  let parsed = aiResponse && aiResponse.response;
  if (typeof parsed === "string") {
    try {
      const jsonMatch = parsed.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : parsed);
    } catch (e) {
      return json({ error: "Could not parse AI response", raw: parsed }, 502, headers);
    }
  }

  if (!parsed || !parsed.roles) {
    return json({ error: "Empty AI response", raw: aiResponse }, 502, headers);
  }

  return json(parsed, 200, headers);
}

// POST /belbin/submit — сотрудник отправляет результат (баллы по 8 ролям +
// сырые ответы — сколько очков дал каждому варианту в каждом вопросе) в
// общую базу (D1). Возвращает id записи для последующего /belbin/submit/ai.
async function handleBelbinSubmit(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const name = body && typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  const department = body && typeof body.department === "string" ? body.department.trim().slice(0, 150) : "";
  const scores = body && body.scores;
  const answers = body && Array.isArray(body.answers) ? body.answers : null;

  if (!name) {
    return json({ error: "Missing name" }, 400, headers);
  }
  if (!validBelbinScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  let insertId;
  try {
    const result = await env.DB.prepare(
      "INSERT INTO belbin_submissions (full_name, department, coordinator, generator, tvorets, issledovatel, ekspert, diplomat, realizator, ispolnitel, answers, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        name,
        department,
        scores.coordinator,
        scores.generator,
        scores.tvorets,
        scores.issledovatel,
        scores.ekspert,
        scores.diplomat,
        scores.realizator,
        scores.ispolnitel,
        answers ? JSON.stringify(answers) : null,
        new Date().toISOString()
      )
      .run();
    insertId = result && result.meta && result.meta.last_row_id;
  } catch (e) {
    return json({ error: "DB insert failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, id: insertId }, 200, headers);
}

// POST /belbin/submit/ai — дописывает в уже существующую запись Белбина
// текст ИИ (intro + roles), если сотрудник нажал "Сформировать отчёт".
async function handleBelbinSubmitAi(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const id = body && body.id;
  const intro = body && typeof body.intro === "string" ? body.intro : "";
  const roles = body && body.roles;

  if (!id || !roles) {
    return json({ error: "Missing id or roles" }, 400, headers);
  }

  try {
    await env.DB.prepare("UPDATE belbin_submissions SET ai_intro = ?, ai_roles = ? WHERE id = ?")
      .bind(intro, JSON.stringify(roles), id)
      .run();
  } catch (e) {
    return json({ error: "DB update failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

// POST /admin/belbin/list — по общему паролю отдаёт все сохранённые
// результаты Белбина (для admin.html).
async function handleAdminBelbinList(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let rows;
  try {
    const result = await env.DB.prepare(
      "SELECT id, full_name, department, coordinator, generator, tvorets, issledovatel, ekspert, diplomat, realizator, ispolnitel, answers, ai_intro, ai_roles, submitted_at FROM belbin_submissions ORDER BY submitted_at DESC"
    ).all();
    rows = result.results;
  } catch (e) {
    return json({ error: "DB query failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, rows: rows }, 200, headers);
}

// POST /admin/belbin/delete — по общему паролю удаляет одну запись Белбина.
async function handleAdminBelbinDelete(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  const id = body && body.id;
  if (!id) {
    return json({ error: "Missing id" }, 400, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  try {
    await env.DB.prepare("DELETE FROM belbin_submissions WHERE id = ?").bind(id).run();
  } catch (e) {
    return json({ error: "DB delete failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

// ===== Тест DISC (поведенческий стиль D/I/S/C) =====
//
// 28 блоков по 4 слова (форс-чойс, как в бумажном опроснике) — сотрудник
// в каждом блоке отмечает слово, которое подходит "больше всего", и слово,
// которое подходит "меньше всего". Итоговый балл по каждой букве —
// (сколько раз выбрали "больше всего") минус (сколько раз выбрали "меньше
// всего"), от -28 до +28. Соответствие слов буквам взято прямо с бланка
// бумажного теста (см. Cabinet/quiz-disc.js) — смысловой интерпретации
// тут не требуется, буквы были явно указаны в опроснике.

const DISC_LETTER_ORDER = ["d", "i", "s", "c"];

const DISC_LETTER_LABELS = {
  d: "D — Доминирование",
  i: "I — Влияние",
  s: "S — Постоянство",
  c: "C — Соответствие",
};

// Краткие справочные описания — контекст для ИИ, чтобы текст опирался на
// реальную характеристику типа, а не выдумывал её с нуля.
const DISC_LETTER_INFO = {
  d: "Уверенность, ориентация на результат и скорость, готовность к риску и соревновательности. Слабые стороны — нетерпеливость, резкость, невнимание к деталям.",
  i: "Общительность, оптимизм, умение убеждать и вдохновлять, потребность в признании. Слабые стороны — импульсивность, неорганизованность, нелюбовь к рутине и бумагам.",
  s: "Надёжность, спокойствие, забота о людях, любовь к порядку и стабильности. Слабые стороны — уступчивость, боязнь перемен, сложности с отказом.",
  c: "Точность, методичность, внимание к деталям и фактам, желание быть правым. Слабые стороны — излишняя критичность, перфекционизм, закрытость.",
};

const DISC_REPORT_SCHEMA = {
  type: "object",
  properties: {
    decoding: { type: "string" },
    behavior: { type: "string" },
    strengths: { type: "string" },
    risks: { type: "string" },
    advice: { type: "string" },
    professions: { type: "string" },
    final_advice: { type: "string" },
  },
  required: ["decoding", "behavior", "strengths", "risks", "advice", "professions", "final_advice"],
};

function validDiscScores(scores) {
  if (!scores) return false;
  return DISC_LETTER_ORDER.every((k) => typeof scores[k] === "number");
}

// POST /disc — персональный ИИ-текст по баллам D/I/S/C.
async function handleDiscReport(request, env, headers) {
  if (!env.AI) {
    return json({ error: "AI binding is not configured — проверь [ai] в wrangler.toml" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const scores = body && body.scores;
  const name = body && typeof body.name === "string" ? body.name.slice(0, 60) : "";

  if (!validDiscScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  const scoreLines = DISC_LETTER_ORDER.map((key) => `${DISC_LETTER_LABELS[key]}: ${scores[key]} баллов`).join("\n");
  const infoLines = DISC_LETTER_ORDER.map((key) => `${DISC_LETTER_LABELS[key]} — ${DISC_LETTER_INFO[key]}`).join(
    "\n\n"
  );

  const prompt = `Ты — консультант по поведенческому профилю DISC. Человек прошёл тест из 28 блоков по 4 слова (форс-чойс): в каждом блоке отметил слово, которое подходит ему "больше всего", и слово, которое подходит "меньше всего". Итоговый балл по каждой из 4 букв — от -28 до +28: чем выше балл, тем сильнее выражена черта, чем ниже (в минус) — тем слабее выражена.

Баллы человека${name ? ` (${name})` : ""}:
${scoreLines}

Справочные описания типов (используй как основу, не копируй дословно):
${infoLines}

Заполни JSON-объект:
- decoding — 4-6 предложений: по очереди разбери, что означает КАЖДЫЙ из четырёх баллов (D, I, S и C) именно у этого человека, опираясь на конкретные цифры и на то, какие баллы высокие, а какие низкие или отрицательные.
- behavior — 2-4 предложения: как это сочетание баллов проявляется в обычной работе и как — в состоянии стресса.
- strengths — 2-4 предложения: сильные стороны, которые дают именно эти баллы.
- risks — 2-4 предложения: риски и слабые места, на которые стоит обратить внимание.
- advice — 3-5 предложений: практические советы — что делать в команде, в коммуникации, в личной организации, с опорой на конкретное сочетание баллов.
- professions — 2-4 предложения: какие роли, задачи и типы работы подходят лучше всего, а каких стоит по возможности избегать.
- final_advice — 1-2 предложения короткого итогового совета.

Пиши строго на русском языке, тёплым, но деловым тоном, без канцелярита, без списков и маркеров (•, -, цифр с точкой) внутри текста — только связные предложения. Каждое слово должно быть русским: не используй слова и вставки из английского, украинского, сербского, хорватского или любого другого языка ни в исходной, ни в изменённой форме.`;

  const model = env.MODEL || "@cf/meta/llama-3.1-8b-instruct-fast";

  let aiResponse;
  try {
    aiResponse = await env.AI.run(model, {
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: DISC_REPORT_SCHEMA,
      },
      max_tokens: 1800,
    });
  } catch (e) {
    return json({ error: "Workers AI request failed", details: String(e) }, 502, headers);
  }

  let parsed = aiResponse && aiResponse.response;
  if (typeof parsed === "string") {
    try {
      const jsonMatch = parsed.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : parsed);
    } catch (e) {
      return json({ error: "Could not parse AI response", raw: parsed }, 502, headers);
    }
  }

  if (!parsed || !parsed.decoding) {
    return json({ error: "Empty AI response", raw: aiResponse }, 502, headers);
  }

  return json(parsed, 200, headers);
}

// POST /disc/submit — сотрудник отправляет результат (баллы по 4 буквам +
// сырые ответы — какой вариант выбран "больше/меньше всего" в каждом
// блоке) в общую базу (D1). Возвращает id записи для /disc/submit/ai.
async function handleDiscSubmit(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const name = body && typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  const department = body && typeof body.department === "string" ? body.department.trim().slice(0, 150) : "";
  const scores = body && body.scores;
  const answers = body && Array.isArray(body.answers) ? body.answers : null;

  if (!name) {
    return json({ error: "Missing name" }, 400, headers);
  }
  if (!validDiscScores(scores)) {
    return json({ error: "Missing or invalid scores" }, 400, headers);
  }

  let insertId;
  try {
    const result = await env.DB.prepare(
      "INSERT INTO disc_submissions (full_name, department, d_score, i_score, s_score, c_score, answers, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        name,
        department,
        scores.d,
        scores.i,
        scores.s,
        scores.c,
        answers ? JSON.stringify(answers) : null,
        new Date().toISOString()
      )
      .run();
    insertId = result && result.meta && result.meta.last_row_id;
  } catch (e) {
    return json({ error: "DB insert failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, id: insertId }, 200, headers);
}

// POST /disc/submit/ai — дописывает в уже существующую запись DISC текст ИИ
// (весь объект отчёта целиком, как один JSON), если сотрудник нажал
// "Сформировать отчёт".
async function handleDiscSubmitAi(request, env, headers) {
  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  const id = body && body.id;
  const report = body && body.report;

  if (!id || !report) {
    return json({ error: "Missing id or report" }, 400, headers);
  }

  try {
    await env.DB.prepare("UPDATE disc_submissions SET ai_report = ? WHERE id = ?").bind(JSON.stringify(report), id).run();
  } catch (e) {
    return json({ error: "DB update failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

// POST /admin/disc/list — по общему паролю отдаёт все сохранённые
// результаты DISC (для admin.html).
async function handleAdminDiscList(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let rows;
  try {
    const result = await env.DB.prepare(
      "SELECT id, full_name, department, d_score, i_score, s_score, c_score, answers, ai_report, submitted_at FROM disc_submissions ORDER BY submitted_at DESC"
    ).all();
    rows = result.results;
  } catch (e) {
    return json({ error: "DB query failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, rows: rows }, 200, headers);
}

// POST /admin/disc/delete — по общему паролю удаляет одну запись DISC.
async function handleAdminDiscDelete(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  const id = body && body.id;
  if (!id) {
    return json({ error: "Missing id" }, 400, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  try {
    await env.DB.prepare("DELETE FROM disc_submissions WHERE id = ?").bind(id).run();
  } catch (e) {
    return json({ error: "DB delete failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

// POST /admin/list — по общему паролю отдаёт все сохранённые результаты
// (для страницы admin.html). Пароль хранится как secret (wrangler secret
// put ADMIN_PASSWORD), а не как обычная переменная — поэтому не виден ни
// в wrangler.toml, ни в выводе команды деплоя.
async function handleAdminList(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  let rows;
  try {
    const result = await env.DB.prepare(
      "SELECT id, full_name, department, safety, belonging, esteem, selfact, answers, ai_breakdown, ai_recommendations, submitted_at FROM submissions ORDER BY submitted_at DESC"
    ).all();
    rows = result.results;
  } catch (e) {
    return json({ error: "DB query failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true, rows: rows }, 200, headers);
}

// POST /admin/delete — по общему паролю удаляет одну запись (кнопка
// "Удалить" в admin.html). Тоже требует пароль в теле запроса, как и
// /admin/list — без пароля удалить ничего нельзя.
async function handleAdminDelete(request, env, headers) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "ADMIN_PASSWORD is not configured — см. README.md" }, 500, headers);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Bad request", { status: 400, headers });
  }

  if (!body || body.password !== env.ADMIN_PASSWORD) {
    return json({ error: "Неверный пароль" }, 401, headers);
  }

  const id = body && body.id;
  if (!id) {
    return json({ error: "Missing id" }, 400, headers);
  }

  if (!env.DB) {
    return json({ error: "DB binding is not configured — см. README.md, раздел про базу данных" }, 500, headers);
  }

  try {
    await env.DB.prepare("DELETE FROM submissions WHERE id = ?").bind(id).run();
  } catch (e) {
    return json({ error: "DB delete failed", details: String(e) }, 500, headers);
  }

  return json({ ok: true }, 200, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const requestOrigin = request.headers.get("Origin") || "";
    const headers = corsHeaders(allowedOrigin, requestOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers });
    }

    // Простая защита от чужих сайтов: если ALLOWED_ORIGIN задан явно (не "*"),
    // запрос без совпадающего Origin отклоняем — это не железная защита,
    // но отсекает случайных ботов, которые иначе жгли бы твою дневную квоту.
    // Админка (admin.html) открывается напрямую с диска или отдельного адреса,
    // поэтому для /admin/* Origin не проверяем так строго — там своя защита
    // паролем внутри самих обработчиков.
    if (
      url.pathname.indexOf("/admin/") !== 0 &&
      allowedOrigin !== "*" &&
      requestOrigin &&
      requestOrigin !== allowedOrigin
    ) {
      return new Response("Forbidden", { status: 403, headers });
    }

    if (url.pathname === "/submit") return handleSubmit(request, env, headers);
    if (url.pathname === "/submit/ai") return handleSubmitAi(request, env, headers);
    if (url.pathname === "/admin/list") return handleAdminList(request, env, headers);
    if (url.pathname === "/admin/delete") return handleAdminDelete(request, env, headers);
    if (url.pathname === "/belbin") return handleBelbinReport(request, env, headers);
    if (url.pathname === "/belbin/submit") return handleBelbinSubmit(request, env, headers);
    if (url.pathname === "/belbin/submit/ai") return handleBelbinSubmitAi(request, env, headers);
    if (url.pathname === "/admin/belbin/list") return handleAdminBelbinList(request, env, headers);
    if (url.pathname === "/admin/belbin/delete") return handleAdminBelbinDelete(request, env, headers);
    if (url.pathname === "/disc") return handleDiscReport(request, env, headers);
    if (url.pathname === "/disc/submit") return handleDiscSubmit(request, env, headers);
    if (url.pathname === "/disc/submit/ai") return handleDiscSubmitAi(request, env, headers);
    if (url.pathname === "/admin/disc/list") return handleAdminDiscList(request, env, headers);
    if (url.pathname === "/admin/disc/delete") return handleAdminDiscDelete(request, env, headers);
    return handleReport(request, env, headers);
  },
};
