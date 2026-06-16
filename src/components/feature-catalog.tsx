"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "./icons";

type IdeaStatus =
  | "Збір підтримки"
  | "На розгляді"
  | "Заплановано"
  | "В роботі"
  | "Впроваджено"
  | "Відхилено";

type FeatureIdea = {
  id: string;
  title: string;
  module: string;
  status: IdeaStatus;
  votes: number;
  impact: number;
  created: string;
  author: string;
  description: string;
  scenario: string;
};

const IDEAS_KEY = "impuls-feature-catalog-v1";
const VOTES_KEY = "impuls-feature-votes-v1";

const seedIdeas: FeatureIdea[] = [
  {
    id: "mass-return",
    title: "Масове повернення зі статусу",
    module: "Відпустка / Відрядження / Лікування",
    status: "Збір підтримки",
    votes: 46,
    impact: 5,
    created: "2026-06-16",
    author: "користувачі ІКС Імпульс",
    description:
      "Додати масову дію для повернення групи військовослужбовців після вибору записів чек-боксами.",
    scenario:
      "Командир подає один рапорт про повернення 10 військовослужбовців з щорічної відпустки. Оператор обирає 10 записів, натискає масову дію, а підстави автоматично підтягуються з відпускних квитків.",
  },
  {
    id: "duplicate-merge",
    title: "Об'єднання дубльованих пропозицій",
    module: "GLPI / Техпідтримка",
    status: "На розгляді",
    votes: 38,
    impact: 4,
    created: "2026-06-15",
    author: "техпідтримка",
    description:
      "Дати модератору можливість об'єднувати схожі ідеї в одну картку зі збереженням голосів і сценаріїв.",
    scenario:
      "Замість десятків однакових тікетів техпідтримка бачить одну пропозицію з переліком підрозділів, які підтримали потребу.",
  },
  {
    id: "template-preview",
    title: "Попередній перегляд документів",
    module: "Документи",
    status: "Заплановано",
    votes: 29,
    impact: 4,
    created: "2026-06-12",
    author: "служба персоналу",
    description:
      "Перед формуванням документа показувати стислий перегляд з підсвічуванням порожніх або сумнівних реквізитів.",
    scenario:
      "Оператор бачить, що в одного військовослужбовця відсутня підстава або дата, і виправляє це до створення DOCX.",
  },
  {
    id: "status-history",
    title: "Історія зміни статусів особи",
    module: "Особовий склад",
    status: "В роботі",
    votes: 24,
    impact: 3,
    created: "2026-06-10",
    author: "стройова частина",
    description:
      "Додати компактну шкалу переходів між статусами з датами, підставами та відповідальним користувачем.",
    scenario:
      "Під час перевірки видно, хто і коли перевів військовослужбовця у відрядження, лікування або повернув до підрозділу.",
  },
];

const today = () => new Date().toISOString().slice(0, 10);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function makeIdeaId(title: string) {
  return `idea-${title.toLocaleLowerCase("uk")
    .replace(/[^a-zа-яіїєґ0-9]+/giu, "-")
    .replace(/^-|-$/g, "")}-${Date.now()}`;
}

function statusTone(status: IdeaStatus) {
  if (status === "В роботі" || status === "Впроваджено") return "status-green";
  if (status === "Заплановано") return "status-gold";
  if (status === "Відхилено") return "status-red";
  return "status-blue";
}

export function FeatureCatalog({ search }: { search: string }) {
  const [ideas, setIdeas] = useState<FeatureIdea[]>(() =>
    readJson(IDEAS_KEY, seedIdeas)
  );
  const [voted, setVoted] = useState<Record<string, boolean>>(() =>
    readJson(VOTES_KEY, {})
  );
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"votes" | "recent" | "impact">("votes");
  const [previewId, setPreviewId] = useState("mass-return");

  useEffect(() => {
    try {
      window.localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
      window.localStorage.setItem(VOTES_KEY, JSON.stringify(voted));
    } catch {
      // Keep the catalog usable for the current session.
    }
  }, [ideas, voted]);

  const modules = useMemo(
    () => [...new Set(ideas.map((idea) => idea.module))]
      .sort((a, b) => a.localeCompare(b, "uk")),
    [ideas],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uk");
    return ideas
      .filter((idea) => {
        const haystack = [
          idea.title,
          idea.module,
          idea.status,
          idea.description,
          idea.scenario,
        ].join(" ").toLocaleLowerCase("uk");
        return (!query || haystack.includes(query)) &&
          (module === "all" || idea.module === module) &&
          (status === "all" || idea.status === status);
      })
      .sort((a, b) => {
        if (sort === "recent") return b.created.localeCompare(a.created);
        if (sort === "impact") return b.impact - a.impact || b.votes - a.votes;
        return b.votes - a.votes || b.impact - a.impact;
      });
  }, [ideas, module, search, sort, status]);

  const preview = ideas.find((idea) => idea.id === previewId) || ideas[0];
  const totalVotes = ideas.reduce((sum, idea) => sum + idea.votes, 0);
  const activeCount = ideas.filter((idea) =>
    ["Заплановано", "В роботі"].includes(idea.status)
  ).length;

  const toggleVote = (id: string) => {
    setIdeas((current) => current.map((idea) => {
      if (idea.id !== id) return idea;
      return { ...idea, votes: idea.votes + (voted[id] ? -1 : 1) };
    }));
    setVoted((current) => {
      const next = { ...current };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const addIdea = (formData: FormData) => {
    const title = String(formData.get("title") || "").trim();
    const ideaModule = String(formData.get("module") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const scenario = String(formData.get("scenario") || "").trim();
    const impact = Number(formData.get("impact") || 3);
    if (!title || !ideaModule || !description || !scenario) return;

    const duplicate = ideas.find((idea) =>
      idea.title.toLocaleLowerCase("uk") === title.toLocaleLowerCase("uk") &&
      idea.module.toLocaleLowerCase("uk") === ideaModule.toLocaleLowerCase("uk")
    );

    if (duplicate) {
      setIdeas((current) => current.map((idea) =>
        idea.id === duplicate.id
          ? {
              ...idea,
              votes: idea.votes + 1,
              scenario: `${idea.scenario}\n\nДодатковий сценарій: ${scenario}`,
            }
          : idea
      ));
      setVoted((current) => ({ ...current, [duplicate.id]: true }));
      setPreviewId(duplicate.id);
      return;
    }

    const id = makeIdeaId(title);
    setIdeas((current) => [{
      id,
      title,
      module: ideaModule,
      status: "Збір підтримки",
      votes: 1,
      impact,
      created: today(),
      author: "новий користувач",
      description,
      scenario,
    }, ...current]);
    setVoted((current) => ({ ...current, [id]: true }));
    setPreviewId(id);
  };

  const exportCsv = () => {
    const header = ["Назва", "Модуль", "Статус", "Голосів", "Вплив", "Опис", "Сценарій"];
    const rows = ideas.map((idea) => [
      idea.title,
      idea.module,
      idea.status,
      idea.votes,
      idea.impact,
      idea.description,
      idea.scenario,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) =>
        `"${String(cell).replaceAll('"', '""')}"`
      ).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Каталог_пропозицій_Імпульс.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ideas-workspace">
      <section className="ideas-summary" aria-label="Показники каталогу">
        <div>
          <span>Пропозицій</span>
          <strong>{ideas.length}</strong>
        </div>
        <div>
          <span>Голосів</span>
          <strong>{totalVotes}</strong>
        </div>
        <div>
          <span>У плані або роботі</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Модулів</span>
          <strong>{modules.length}</strong>
        </div>
      </section>

      <section className="ideas-controls" aria-label="Фільтри пропозицій">
        <select value={module} onChange={(event) => setModule(event.target.value)}>
          <option value="all">Усі модулі</option>
          {modules.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Усі статуси</option>
          <option>Збір підтримки</option>
          <option>На розгляді</option>
          <option>Заплановано</option>
          <option>В роботі</option>
          <option>Впроваджено</option>
          <option>Відхилено</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="votes">За голосами</option>
          <option value="recent">Нові спочатку</option>
          <option value="impact">За впливом</option>
        </select>
        <button className="secondary-button" type="button" onClick={exportCsv}>
          <Icon name="download" />
          Експорт CSV
        </button>
      </section>

      <div className="ideas-layout">
        <section className="ideas-list" aria-live="polite">
          {filtered.length ? filtered.map((idea) => (
            <article className="idea-card" key={idea.id}>
              <div className="idea-votes">
                <button
                  type="button"
                  aria-pressed={Boolean(voted[idea.id])}
                  aria-label={`Підтримати пропозицію ${idea.title}`}
                  onClick={() => toggleVote(idea.id)}
                >
                  ▲
                </button>
                <strong>{idea.votes}</strong>
                <span>голосів</span>
              </div>
              <div className="idea-body">
                <div className="idea-heading">
                  <h2>{idea.title}</h2>
                  <span className={`idea-status ${statusTone(idea.status)}`}>
                    {idea.status}
                  </span>
                  {idea.votes >= 40 && <span className="idea-hot">високий попит</span>}
                </div>
                <p>{idea.description}</p>
                <div className="idea-meta">
                  <span>{idea.module}</span>
                  <span>Вплив: {"●".repeat(idea.impact)}</span>
                  <span>{idea.author}</span>
                  <span>{idea.created}</span>
                </div>
                <blockquote>{idea.scenario}</blockquote>
              </div>
              <button
                className="secondary-button idea-demo-button"
                type="button"
                onClick={() => setPreviewId(idea.id)}
              >
                <Icon name="file" />
                Демо
              </button>
            </article>
          )) : (
            <div className="empty-state">
              <div className="empty-icon"><Icon name="search" /></div>
              <strong>Пропозицій не знайдено</strong>
              <span>Змініть пошук або фільтри каталогу.</span>
            </div>
          )}
        </section>

        <aside className="ideas-side">
          <section className="idea-panel">
            <h2>Нова пропозиція</h2>
            <p>
              Якщо така ідея вже є, система додасть голос і сценарій до наявної
              картки замість дублювання.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addIdea(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
            >
              <label>
                Назва
                <input name="title" required maxLength={100} />
              </label>
              <label>
                Модуль
                <input
                  name="module"
                  required
                  list="idea-modules"
                  placeholder="Наприклад: GLPI / Відпустка"
                />
              </label>
              <datalist id="idea-modules">
                {modules.map((item) => <option key={item} value={item} />)}
              </datalist>
              <label>
                Вплив
                <select name="impact" defaultValue="4">
                  <option value="5">Критичний</option>
                  <option value="4">Високий</option>
                  <option value="3">Середній</option>
                  <option value="2">Низький</option>
                </select>
              </label>
              <label>
                Опис
                <textarea name="description" required rows={3} />
              </label>
              <label>
                Практичний сценарій
                <textarea name="scenario" required rows={4} />
              </label>
              <button className="primary-button" type="submit">
                <Icon name="plus" />
                Опублікувати
              </button>
            </form>
          </section>

          {preview && (
            <section className="idea-panel demo-panel">
              <span className="eyebrow">Демо сценарій</span>
              <h2>{preview.title}</h2>
              <div className="demo-steps">
                {(preview.id === "mass-return"
                  ? [
                      ["1. Обрати", "Оператор відмічає декілька осіб чек-боксами."],
                      ["2. Дія", "У меню масових дій натискає «Повернути зі статусу»."],
                      ["3. Підстави", "Система підтягує квитки, посвідчення або медичні документи."],
                      ["4. Журнал", "Статуси змінюються одним підтвердженням із записом аудиту."],
                    ]
                  : [
                      ["1. Знайти", "Користувач шукає наявну пропозицію."],
                      ["2. Підтримати", "Додає голос і сценарій свого підрозділу."],
                      ["3. Пріоритет", "Техпідтримка бачить попит без ручного сортування дублів."],
                      ["4. Roadmap", "Розробники отримують узгоджений опис і статус."],
                    ]).map(([title, text]) => (
                      <div key={title}>
                        <strong>{title}</strong>
                        <span>{text}</span>
                      </div>
                    ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
