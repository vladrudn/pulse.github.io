"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { downloadOrderDocument } from "@/lib/document";
import { formatOrderPerson } from "@/lib/order-format";
import {
  people,
  personById,
  sedoById,
  sedoReports,
  unitNames,
} from "@/lib/test-data";
import type {
  AidKind,
  AidRequest,
  Person,
  RequestStatus,
  WorkspaceState,
} from "@/lib/types";
import { FeatureCatalog } from "./feature-catalog";
import { Icon, type IconName } from "./icons";

type FinanceView = "people" | "sedo" | "processed";
type View = FinanceView | "ideas";
type Toast = { type: "success" | "error"; text: string } | null;

const STORAGE_KEY = "impuls-gdo-workspace-v1";
const REPORT_INCREMENT_KEY = "impuls-gdo-report-increment-v1";
const LAST_MANUAL_REPORT_KEY = "impuls-gdo-last-manual-report-v1";
const LAST_MANUAL_REPORT_DATE_KEY = "impuls-gdo-last-manual-report-date-v1";
const BASIS_HISTORY_KEY = "impuls-md-basis-history-v1";
const LEGACY_CIRCUMSTANCES_KEY = "impuls-md-last-circumstances-v1";
const LEGACY_ADDITIONAL_BASIS_KEY = "impuls-md-last-additional-basis-v1";
const readStoredHistory = (key: string) => {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string =>
          typeof value === "string" && Boolean(value.trim())
        );
      }
    } catch {
      // Migrate the previously stored single value into history.
    }
    return stored.trim() ? [stored.trim()] : [];
  } catch {
    return [];
  }
};
const addStoredHistoryValue = (key: string, history: string[], value: string) => {
  const normalized = value.trim();
  if (!normalized) return history;
  const next = [
    normalized,
    ...history.filter((item) =>
      item.toLocaleLowerCase("uk") !== normalized.toLocaleLowerCase("uk")
    ),
  ].slice(0, 20);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Keep the updated history available for the current session.
  }
  return next;
};
const getRequestBases = (request: AidRequest) => (
  request.bases?.length
    ? request.bases
    : [request.circumstances, request.vlk]
).map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("uk-UA").format(new Date(`${value}T00:00:00`))
    : "—";
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const normalizeManualReportNumber = (value: string) =>
  value.trim().replace(/\s*\/\s*р\s*$/iu, "");
const nextManualReportNumber = (value: string | null) => {
  if (!value) return "";
  const normalized = normalizeManualReportNumber(value);
  return /^\d+$/.test(normalized) ? String(Number(normalized) + 1) : "";
};
const sedoSubjectFor = (subject: string, aidKind: AidKind) =>
  aidKind === "material"
    ? "Рапорт про виплату матеріальної допомоги для вирішення соціально-побутових питань"
    : subject;

const initialState: WorkspaceState = { requests: [] };
const subscribeToHydration = () => () => {};

function loadWorkspaceState(): WorkspaceState {
  if (typeof window === "undefined") return initialState;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialState;
    const parsed = JSON.parse(stored) as WorkspaceState;
    return {
      requests: (parsed.requests || []).map((request) => ({
        ...request,
        aidKind: request.aidKind || "wellness",
      })),
    };
  } catch {
    return initialState;
  }
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      Опрацьовано
    </span>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name="file" /></div>
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}

export function ImpulsWorkspace() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return (
      <div className="app-loading" role="status">
        <div className="brand-mark"><Icon name="activity" /></div>
        <span>Завантаження робочого простору…</span>
      </div>
    );
  }

  return <ImpulsWorkspaceContent />;
}

function ImpulsWorkspaceContent() {
  const [aidKind, setAidKind] = useState<AidKind>("wellness");
  const [view, setView] = useState<View>("people");
  const [state, setState] = useState<WorkspaceState>(loadWorkspaceState);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("all");
  const [drawerPerson, setDrawerPerson] = useState<Person | null>(null);
  const [selectedSedo, setSelectedSedo] = useState<Set<string>>(new Set());
  const [orderDate, setOrderDate] = useState(today());
  const [selectedOrderDate, setSelectedOrderDate] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [density, setDensity] = useState<"normal" | "compact">("normal");
  const [financeNavOpen, setFinanceNavOpen] = useState(true);
  const [wellnessNavOpen, setWellnessNavOpen] = useState(true);
  const [materialNavOpen, setMaterialNavOpen] = useState(false);
  const [recentPersonId, setRecentPersonId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The workspace remains usable for the current session.
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!recentPersonId) return;
    const timer = window.setTimeout(() => setRecentPersonId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [recentPersonId]);

  const requestsByPerson = useMemo(() => {
    const map = new Map<string, AidRequest[]>();
    state.requests
      .filter((request) => request.aidKind === aidKind)
      .forEach((request) => {
      map.set(request.personId, [...(map.get(request.personId) || []), request]);
    });
    return map;
  }, [aidKind, state.requests]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uk");
    return people.filter((person) => {
      const matchesUnit = unit === "all" || person.unit === unit;
      const haystack = [
        person.fullName,
        person.taxId,
        person.rank,
        person.position,
        person.unit,
      ].join(" ").toLocaleLowerCase("uk");
      return matchesUnit && (!query || haystack.includes(query));
    });
  }, [search, unit]);

  const filteredSedo = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uk");
    return sedoReports.filter((report) => {
      const person = personById.get(report.personId);
      const matchesUnit = unit === "all" || person?.unit === unit;
      const haystack = [
        report.number,
        report.correspondent,
        sedoSubjectFor(report.subject, aidKind),
        person?.unit,
      ].join(" ").toLocaleLowerCase("uk");
      return matchesUnit && (!query || haystack.includes(query));
    });
  }, [aidKind, search, unit]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("uk");
    return state.requests.filter((request) => {
      const person = personById.get(request.personId);
      const haystack = [
        person?.fullName,
        person?.unit,
        person?.taxId,
        request.reportNumber,
      ].join(" ").toLocaleLowerCase("uk");
      return request.aidKind === aidKind &&
        request.status === "processed" &&
        (unit === "all" || person?.unit === unit) &&
        (!query || haystack.includes(query));
    });
  }, [aidKind, search, state.requests, unit]);

  const orderDates = useMemo(
    () => [...new Set(
      state.requests
        .filter((request) => request.status === "processed")
        .map((request) => request.orderDate),
    )].sort((a, b) => b.localeCompare(a)),
    [state.requests],
  );
  const effectiveOrderDate = orderDates.includes(selectedOrderDate)
    ? selectedOrderDate
    : orderDates[0] || "";
  const selectedOrderRequests = state.requests.filter((request) =>
    request.status === "processed" &&
    request.orderDate === effectiveOrderDate
  );
  const selectedOrderWellnessCount = selectedOrderRequests.filter(
    (request) => request.aidKind === "wellness",
  ).length;
  const selectedOrderMaterialCount = selectedOrderRequests.filter(
    (request) => request.aidKind === "material",
  ).length;

  const processedCount = state.requests.filter((item) =>
    item.aidKind === aidKind && item.status === "processed"
  ).length;
  const pendingSedoCount = sedoReports.filter((report) =>
    !state.requests.some((request) =>
      request.aidKind === aidKind && request.sedoId === report.id
    )
  ).length;

  const navItems: Array<{
    id: FinanceView;
    label: string;
    icon: IconName;
    count?: number;
  }> = [
    { id: "people", label: "Особовий склад", icon: "users", count: people.length },
    { id: "sedo", label: "Вхідні СЕДО", icon: "inbox", count: pendingSedoCount },
    { id: "processed", label: "Опрацьовано", icon: "archive", count: processedCount },
  ];

  const changeView = (next: View) => {
    setView(next);
    setSearch("");
    setUnit("all");
    setMobileNav(false);
  };

  const changeAidKind = (next: AidKind) => {
    setAidKind(next);
    setView("people");
    setSearch("");
    setUnit("all");
    setSelectedSedo(new Set());
    setMobileNav(false);
    if (next === "wellness") {
      setWellnessNavOpen(true);
      setMaterialNavOpen(false);
    } else {
      setMaterialNavOpen(true);
      setWellnessNavOpen(false);
    }
  };

  const openIdeaCatalog = () => {
    setView("ideas");
    setSearch("");
    setUnit("all");
    setSelectedSedo(new Set());
    setMobileNav(false);
  };

  const showToast = (text: string, type: "success" | "error" = "success") =>
    setToast({ type, text });

  const saveManualRequest = (payload: {
    personId: string;
    reportNumber: string;
    reportDate: string;
    orderDate: string;
    bases?: string[];
  }) => {
    const duplicate = state.requests.some((request) =>
      request.aidKind === aidKind &&
      request.personId === payload.personId &&
      request.reportNumber.trim().toLocaleLowerCase("uk") ===
        payload.reportNumber.trim().toLocaleLowerCase("uk")
    );
    if (duplicate) {
      showToast("Цей рапорт уже додано для обраної особи.", "error");
      return false;
    }
    const request: AidRequest = {
      id: makeId(),
      aidKind,
      source: "manual",
      personId: payload.personId,
      reportNumber: payload.reportNumber.trim(),
      reportDate: payload.reportDate,
      orderDate: payload.orderDate,
      bases: payload.bases?.map((value) => value.trim()).filter(Boolean),
      status: "processed",
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };
    setState((current) => ({
      requests: [...current.requests, request],
    }));
    setDrawerPerson(null);
    setRecentPersonId(payload.personId);
    showToast("Рапорт позначено як опрацьований.");
    return true;
  };

  const addSedoBatch = () => {
    const ids = [...selectedSedo];
    if (!ids.length) {
      showToast("Оберіть хоча б один рапорт СЕДО.", "error");
      return;
    }
    if (!orderDate) {
      showToast("Вкажіть дату проєкту наказу.", "error");
      return;
    }
    const existingSedo = new Set(
      state.requests
        .filter((request) => request.aidKind === aidKind)
        .map((request) => request.sedoId)
        .filter(Boolean),
    );
    const additions: AidRequest[] = ids.flatMap((id) => {
      const report = sedoById.get(id);
      if (!report || existingSedo.has(report.id)) return [];
      return [{
        id: makeId(),
        aidKind,
        personId: report.personId,
        source: "sedo" as const,
        sedoId: report.id,
        reportNumber: report.number,
        reportDate: report.date,
        orderDate,
        bases: aidKind === "material" ? report.materialBases : undefined,
        status: "processed",
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      }];
    });
    if (!additions.length) {
      showToast("Обрані рапорти вже додані до опрацювання.", "error");
      return;
    }
    setState((current) => ({
      requests: [...current.requests, ...additions],
    }));
    setSelectedSedo(new Set());
    showToast(`Опрацьовано рапортів: ${additions.length}.`);
    changeView("processed");
  };

  const downloadSelected = async () => {
    if (!effectiveOrderDate || !selectedOrderRequests.length) {
      showToast("Оберіть наказ для формування документа.", "error");
      return;
    }
    try {
      await downloadOrderDocument(selectedOrderRequests, effectiveOrderDate);
      showToast(`Наказ сформовано. Записів: ${selectedOrderRequests.length}.`);
    } catch {
      showToast("Не вдалося сформувати DOCX.", "error");
    }
  };

  const resetDemo = () => {
    if (!window.confirm("Очистити всі опрацьовані записи?")) return;
    setState(initialState);
    setSelectedSedo(new Set());
    showToast("Тестові робочі дані очищено.");
  };

  return (
    <div className={`app-shell density-${density}`}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Icon name="activity" /></div>
          <div>
            <strong>Pulse</strong>
            <span>тестове середовище</span>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setMobileNav(false)}
            aria-label="Закрити меню"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="role-card">
          <div className="avatar">Д</div>
          <div>
            <strong>Діловод</strong>
            <span>Єдина тестова роль</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Головна навігація">
          <button
            className="nav-disclosure nav-root"
            type="button"
            aria-expanded={financeNavOpen}
            onClick={() => setFinanceNavOpen((current) => !current)}
          >
            <span>Грошове забезпечення</span>
            <Icon
              className={financeNavOpen ? "disclosure-open" : ""}
              name="chevron"
            />
          </button>
          {financeNavOpen && (
            <div className="nav-branch">
              <button
                className={`nav-disclosure nav-category ${
                  aidKind === "wellness" ? "selected" : ""
                }`}
                type="button"
                aria-expanded={wellnessNavOpen}
                onClick={() => {
                  if (aidKind === "wellness") {
                    setWellnessNavOpen((current) => !current);
                  } else {
                    changeAidKind("wellness");
                  }
                }}
              >
                <span>Для оздоровлення</span>
                <Icon
                  className={wellnessNavOpen ? "disclosure-open" : ""}
                  name="chevron"
                />
              </button>
              {wellnessNavOpen && (
                <div className="nav-items">
                  {navItems.map((item) => (
                    <button
                      key={`wellness-${item.id}`}
                      className={aidKind === "wellness" && view === item.id
                        ? "active"
                        : ""}
                      onClick={() => {
                        if (aidKind !== "wellness") changeAidKind("wellness");
                        changeView(item.id);
                      }}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {typeof item.count === "number" && <b>{item.count}</b>}
                    </button>
                  ))}
                </div>
              )}
              <button
                className={`nav-disclosure nav-category ${
                  aidKind === "material" ? "selected" : ""
                }`}
                type="button"
                aria-expanded={materialNavOpen}
                onClick={() => {
                  if (aidKind === "material") {
                    setMaterialNavOpen((current) => !current);
                  } else {
                    changeAidKind("material");
                  }
                }}
              >
                <span>Матеріальна допомога</span>
                <Icon
                  className={materialNavOpen ? "disclosure-open" : ""}
                  name="chevron"
                />
              </button>
              {materialNavOpen && (
                <div className="nav-items">
                  {navItems.map((item) => (
                    <button
                      key={`material-${item.id}`}
                      className={aidKind === "material" && view === item.id
                        ? "active"
                        : ""}
                      onClick={() => {
                        if (aidKind !== "material") changeAidKind("material");
                        changeView(item.id);
                      }}
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {typeof item.count === "number" && <b>{item.count}</b>}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="nav-category future"
                type="button"
                disabled
                title="Буде реалізовано згодом"
              >
                <span>Перший контракт</span>
                <small>Згодом</small>
              </button>
            </div>
          )}
          <button
            className={`nav-disclosure nav-root standalone-nav ${
              view === "ideas" ? "active" : ""
            }`}
            type="button"
            onClick={openIdeaCatalog}
          >
            <Icon name="file" />
            <span>Каталог пропозицій</span>
            <b>4</b>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={resetDemo}>
            <Icon name="settings" />
            Очистити тестові дані
          </button>
          <small>Дані зберігаються у цьому браузері</small>
        </div>
      </aside>

      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Закрити меню"
        />
      )}

      <main className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Відкрити меню"
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumb">
            {view === "ideas" ? (
              <>
                GLPI <Icon name="chevron" />
                Зворотний зв&apos;язок <Icon name="chevron" />
                <strong>Каталог пропозицій</strong>
              </>
            ) : (
              <>
                Грошове забезпечення <Icon name="chevron" />
                {aidKind === "material" ? "Матеріальна допомога" : "Для оздоровлення"}{" "}
                <Icon name="chevron" />
                <strong>{navItems.find((item) => item.id === view)?.label}</strong>
              </>
            )}
          </div>
          <span className="test-label">DEMO · {people.length} тестових осіб</span>
          {view !== "ideas" && (
            <span
              className="disabled-import-wrap"
              data-tooltip="Імпорт таблиці з даними рапортів із СЕДО недоступний у демоверсії."
              tabIndex={0}
            >
              <button
                type="button"
                className="disabled-import-button"
                disabled
                aria-label="Імпорт таблиці з даними рапортів із СЕДО недоступний у демоверсії"
              >
                <Icon name="upload" />
                Імпорт
              </button>
            </span>
          )}
        </header>

        <section className="content">
          {view === "ideas" ? (
            <>
              <section className="page-heading ideas-heading">
                <div>
                  <span className="eyebrow">GLPI · банк ідей</span>
                  <h1>Каталог пропозицій ІКС «Імпульс»</h1>
                  <p>
                    Спільний реєстр покращень із голосуванням, сценаріями
                    використання та статусами розгляду.
                  </p>
                </div>
              </section>
              <section className="registry-card ideas-registry">
                <div className="toolbar">
                  <label className="search-field">
                    <Icon name="search" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Пошук за пропозиціями"
                      aria-label="Пошук за пропозиціями"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        aria-label="Очистити пошук"
                        tabIndex={-1}
                      >
                        <Icon name="x" />
                      </button>
                    )}
                  </label>
                </div>
                <FeatureCatalog search={search} />
              </section>
            </>
          ) : (
            <section className="registry-card">
              <div className="toolbar">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Загальний пошук"
                    aria-label="Загальний пошук"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Очистити пошук"
                      tabIndex={-1}
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </label>
                <div className="toolbar-spacer" />
                <button
                  className="secondary-button density-button"
                  onClick={() =>
                    setDensity((current) =>
                      current === "normal" ? "compact" : "normal"
                    )}
                  tabIndex={-1}
                >
                  <Icon name="menu" />
                  {density === "normal" ? "Щільніше" : "Звичайно"}
                </button>
              </div>

              {view === "people" && (
                <PeopleTable
                  people={filteredPeople}
                  requestsByPerson={requestsByPerson}
                  unit={unit}
                  setUnit={setUnit}
                  onOpen={setDrawerPerson}
                  recentPersonId={recentPersonId}
                />
              )}
              {view === "sedo" && (
                <SedoTable
                  reports={filteredSedo}
                  aidKind={aidKind}
                  selected={selectedSedo}
                  setSelected={setSelectedSedo}
                  requestsByPerson={requestsByPerson}
                  unit={unit}
                  setUnit={setUnit}
                  usedIds={new Set(
                    state.requests
                      .filter((request) => request.aidKind === aidKind)
                      .map((request) => request.sedoId)
                      .filter(Boolean) as string[],
                  )}
                />
              )}
              {view === "processed" && (
                <RequestsTable
                  requests={visibleRequests}
                  aidKind={aidKind}
                  unit={unit}
                  setUnit={setUnit}
                />
              )}

              <div className="table-footer">
                <span>
                  Показано:{" "}
                  <strong>
                    {view === "people"
                      ? filteredPeople.length
                      : view === "sedo"
                        ? filteredSedo.length
                        : visibleRequests.length}
                  </strong>
                </span>
                <span>Тестові дані · сторінка 1 з 1</span>
              </div>
            </section>
          )}
        </section>

        {view === "sedo" && selectedSedo.size > 0 && (
          <div className="action-dock">
            <div>
              <strong>Обрано рапортів: {selectedSedo.size}</strong>
              <span>Кожен рапорт буде окремим записом</span>
            </div>
            <label>
              Дата проєкту наказу
              <input
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
              />
            </label>
            <button className="primary-button" onClick={() => addSedoBatch()}>
              <Icon name="check" />
              Опрацювати пакет
            </button>
          </div>
        )}

        {view === "processed" && orderDates.length > 0 && (
          <div className="action-dock">
            <div>
              <strong>
                У наказі: {selectedOrderRequests.length}
              </strong>
              <span>
                ГДО: {selectedOrderWellnessCount} · МД: {selectedOrderMaterialCount}
              </span>
            </div>
            <label>
              Наказ за датою
              <select
                value={effectiveOrderDate}
                onChange={(event) => setSelectedOrderDate(event.target.value)}
                aria-label="Оберіть наказ за датою"
              >
                {orderDates.map((date) => {
                  const datedRequests = state.requests.filter((request) =>
                    request.status === "processed" &&
                    request.orderDate === date
                  );
                  const wellnessCount = datedRequests.filter(
                    (request) => request.aidKind === "wellness",
                  ).length;
                  const materialCount = datedRequests.filter(
                    (request) => request.aidKind === "material",
                  ).length;
                  return (
                    <option key={date} value={date}>
                      {formatDate(date)} · ГДО {wellnessCount} · МД {materialCount}
                    </option>
                  );
                })}
              </select>
            </label>
            <button className="primary-button" onClick={downloadSelected}>
              <Icon name="download" />
              Завантажити DOCX
            </button>
          </div>
        )}
      </main>

      {drawerPerson && (
        <RequestDrawer
          person={drawerPerson}
          latest={requestsByPerson.get(drawerPerson.id)?.at(-1)}
          aidKind={aidKind}
          onClose={() => setDrawerPerson(null)}
          onSave={saveManualRequest}
        />
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

function UnitHeaderFilter({
  unit,
  setUnit,
}: {
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
}) {
  return (
    <label className={`header-filter ${unit !== "all" ? "is-active" : ""}`}>
      <span>{unit === "all" ? "Підрозділ" : `Підрозділ: ${unit}`}</span>
      <span className="header-filter-arrow" aria-hidden="true" />
      <select
        value={unit}
        onChange={(event) => setUnit(event.target.value)}
        aria-label="Фільтр за підрозділом"
      >
        <option value="all">Усі підрозділи</option>
        {unitNames.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
    </label>
  );
}

function PeopleTable({
  people: rows,
  requestsByPerson,
  unit,
  setUnit,
  onOpen,
  recentPersonId,
}: {
  people: Person[];
  requestsByPerson: Map<string, AidRequest[]>;
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
  onOpen: (person: Person) => void;
  recentPersonId: string | null;
}) {
  if (!rows.length) {
    return <EmptyState title="Нічого не знайдено" text="Змініть пошуковий запит або фільтр." />;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <UnitHeaderFilter unit={unit} setUnit={setUnit} />
            </th>
            <th>Військове звання</th>
            <th>ПІБ</th>
            <th>Посада</th>
            <th>РНОКПП</th>
            <th>Стан</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((person) => {
            const requests = requestsByPerson.get(person.id) || [];
            const latest = requests.at(-1);
            return (
              <tr
                key={person.id}
                className={person.id === recentPersonId ? "row-recent" : undefined}
                tabIndex={0}
                onDoubleClick={() => onOpen(person)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(person);
                }}
              >
                <td><span className="unit-code">{person.unit}</span></td>
                <td>{person.rank}</td>
                <td>
                  <strong className="person-name">{person.fullName}</strong>
                  {person.flags.map((flag) => (
                    <span
                      className={`warning-tag ${flag === "СЗЧ" ? "warning-tag-danger" : ""}`}
                      key={flag}
                    >
                      {flag}
                    </span>
                  ))}
                </td>
                <td className="position-cell">{person.position}</td>
                <td className="mono">{person.taxId}</td>
                <td>
                  {latest
                    ? <StatusBadge status={latest.status} />
                    : <span className="muted-status">Не опрацьовано</span>}
                </td>
                <td className="actions-cell">
                  <button
                    className="row-action"
                    onClick={() => onOpen(person)}
                    aria-label={`Створити запис для ${person.fullName}`}
                  >
                    <Icon name="plus" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SedoTable({
  reports,
  aidKind,
  selected,
  setSelected,
  requestsByPerson,
  unit,
  setUnit,
  usedIds,
}: {
  reports: typeof sedoReports;
  aidKind: AidKind;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  requestsByPerson: Map<string, AidRequest[]>;
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
  usedIds: Set<string>;
}) {
  const available = reports.filter((report) => !usedIds.has(report.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const toggleAll = () =>
    setSelected((current) =>
      available.length > 0 && available.every((report) => current.has(report.id))
        ? new Set()
        : new Set(available.map((report) => report.id))
    );

  if (!reports.length) {
    return <EmptyState title="Вхідних рапортів не знайдено" text="Змініть пошуковий запит або фільтр." />;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input
                type="checkbox"
                checked={available.length > 0 &&
                  available.every((report) => selected.has(report.id))}
                onChange={toggleAll}
                aria-label="Обрати всі доступні рапорти"
              />
            </th>
            <th>Дата реєстрації</th>
            <th>№ документа</th>
            <th>Кореспондент</th>
            <th>
              <UnitHeaderFilter unit={unit} setUnit={setUnit} />
            </th>
            <th>Короткий зміст</th>
            <th>{aidKind === "material" ? "Стан МД" : "Стан ГДО"}</th>
            <th>Стан документа</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const person = personById.get(report.personId);
            const used = usedIds.has(report.id);
            const latestRequest = requestsByPerson.get(report.personId)?.at(-1);
            return (
              <tr
                key={report.id}
                className={used ? "row-used" : selected.has(report.id) ? "row-selected" : ""}
                onClick={() => !used && toggle(report.id)}
              >
                <td className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selected.has(report.id)}
                    disabled={used}
                    onChange={() => toggle(report.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Обрати рапорт ${report.number}`}
                  />
                </td>
                <td>{formatDateTime(report.registeredAt)}</td>
                <td><strong className="document-number">{report.number}</strong></td>
                <td>
                  <strong className="person-name">{report.correspondent}</strong>
                  {person?.flags.map((flag) => (
                    <span
                      className={`warning-tag ${flag === "СЗЧ" ? "warning-tag-danger" : ""}`}
                      key={flag}
                    >
                      {flag}
                    </span>
                  ))}
                  <span className="subline">{person?.rank}</span>
                </td>
                <td><span className="unit-code">{person?.unit}</span></td>
                <td className="subject-cell">
                  {sedoSubjectFor(report.subject, aidKind)}
                  {aidKind === "material" && report.materialBases?.length ? (
                    <span className="subline">
                      {report.materialBases.join("; ")}
                    </span>
                  ) : null}
                </td>
                <td>
                  {latestRequest
                    ? <StatusBadge status={latestRequest.status} />
                    : <span className="muted-status">Не опрацьовано</span>}
                </td>
                <td>
                  {used
                    ? <span className="used-label"><Icon name="check" /> Додано</span>
                    : <span className="new-label">Новий</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestsTable({
  requests,
  aidKind,
  unit,
  setUnit,
}: {
  requests: AidRequest[];
  aidKind: AidKind;
  unit: string;
  setUnit: Dispatch<SetStateAction<string>>;
}) {
  if (!requests.length) {
    return (
      <EmptyState
        title="Реєстр порожній"
        text="Створіть запис з особового складу або додайте пакет із СЕДО."
      />
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <UnitHeaderFilter unit={unit} setUnit={setUnit} />
            </th>
            <th>Військовослужбовець</th>
            <th>Рапорт</th>
            <th>Дата рапорту</th>
            <th>Дата проєкту наказу</th>
            {aidKind === "material" && <th>Додаткові підстави</th>}
            <th>Джерело</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const person = personById.get(request.personId);
            return (
              <tr
                key={request.id}
              >
                <td><span className="unit-code">{person?.unit}</span></td>
                <td>
                  <strong className="person-name">{person?.fullName}</strong>
                  <span className="subline">{person?.rank} · {person?.position}</span>
                </td>
                <td><strong className="document-number">№ {request.reportNumber}</strong></td>
                <td>{formatDate(request.reportDate)}</td>
                <td>{formatDate(request.orderDate)}</td>
                {aidKind === "material" && (
                  <td className="subject-cell">
                    {getRequestBases(request).join("; ") || "—"}
                  </td>
                )}
                <td>
                  <span className={`source-label source-${request.source}`}>
                    {request.source === "sedo" ? "СЕДО" : "Вручну"}
                  </span>
                </td>
                <td><StatusBadge status={request.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestDrawer({
  person,
  latest,
  aidKind,
  onClose,
  onSave,
}: {
  person: Person;
  latest?: AidRequest;
  aidKind: AidKind;
  onClose: () => void;
  onSave: (payload: {
    personId: string;
    reportNumber: string;
    reportDate: string;
    orderDate: string;
    bases?: string[];
  }) => boolean;
}) {
  const storageKey = (base: string) =>
    aidKind === "material" ? `${base}-material` : base;
  const [incrementReport, setIncrementReport] = useState(() => {
    try {
      return window.localStorage.getItem(
        storageKey(REPORT_INCREMENT_KEY),
      ) === "true";
    } catch {
      return false;
    }
  });
  const [reportNumber, setReportNumber] = useState(() => {
    try {
      const enabled = window.localStorage.getItem(
        storageKey(REPORT_INCREMENT_KEY),
      ) === "true";
      return enabled
        ? nextManualReportNumber(
          window.localStorage.getItem(storageKey(LAST_MANUAL_REPORT_KEY)),
        )
        : "";
    } catch {
      return "";
    }
  });
  const [reportDate, setReportDate] = useState(() => {
    try {
      return window.localStorage.getItem(
        storageKey(LAST_MANUAL_REPORT_DATE_KEY),
      ) || today();
    } catch {
      return today();
    }
  });
  const [formOrderDate, setFormOrderDate] = useState(today());
  const [bases, setBases] = useState([""]);
  const [basisHistory, setBasisHistory] = useState(() => {
    const current = readStoredHistory(BASIS_HISTORY_KEY);
    if (current.length) return current;
    return [
      ...readStoredHistory(LEGACY_CIRCUMSTANCES_KEY),
      ...readStoredHistory(LEGACY_ADDITIONAL_BASIS_KEY),
    ].filter((value, index, values) =>
      values.findIndex((item) =>
        item.toLocaleLowerCase("uk") === value.toLocaleLowerCase("uk")
      ) === index
    );
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    const normalizedReportNumber = normalizeManualReportNumber(reportNumber);
    if (!normalizedReportNumber) nextErrors.reportNumber = "Вкажіть номер рапорту.";
    if (!reportDate) nextErrors.reportDate = "Вкажіть дату рапорту.";
    if (!formOrderDate) nextErrors.orderDate = "Вкажіть дату проєкту наказу.";
    if (reportDate && formOrderDate && reportDate > formOrderDate) {
      nextErrors.reportDate = "Дата рапорту не може бути пізнішою за дату проєкту наказу.";
    }
    if (reportDate > today()) {
      nextErrors.reportDate = "Дата рапорту не може бути майбутньою.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const saved = onSave({
      personId: person.id,
      reportNumber: normalizedReportNumber,
      reportDate,
      orderDate: formOrderDate,
      bases: aidKind === "material" ? bases : undefined,
    });
    if (saved) {
      try {
        window.localStorage.setItem(
          storageKey(LAST_MANUAL_REPORT_DATE_KEY),
          reportDate,
        );
        if (incrementReport) {
          window.localStorage.setItem(
            storageKey(LAST_MANUAL_REPORT_KEY),
            normalizedReportNumber,
          );
        }
      } catch {
        // Saved defaults remain available for the current form.
      }
      if (aidKind === "material") {
        let nextHistory = basisHistory;
        bases.filter((value) => value.trim()).forEach((value) => {
          nextHistory = addStoredHistoryValue(
            BASIS_HISTORY_KEY,
            nextHistory,
            value,
          );
        });
        setBasisHistory(nextHistory);
      }
    }
  };

  const toggleIncrement = () => {
    const enabled = !incrementReport;
    setIncrementReport(enabled);
    try {
      window.localStorage.setItem(
        storageKey(REPORT_INCREMENT_KEY),
        String(enabled),
      );
      if (enabled && !reportNumber) {
        setReportNumber(
          nextManualReportNumber(
            window.localStorage.getItem(storageKey(LAST_MANUAL_REPORT_KEY)),
          ),
        );
      }
    } catch {
      // Keep the toggle usable for the current session.
    }
  };

  return (
    <>
      <button className="drawer-backdrop" onClick={onClose} aria-label="Закрити форму" />
      <aside className="request-drawer" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="eyebrow">Нова подія</span>
            <h2>
              {aidKind === "material"
                ? "Матеріальна допомога"
                : "Грошова допомога для оздоровлення"}
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрити">
            <Icon name="x" />
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
        <div className="drawer-body">
          <section className="person-summary">
            <div className="person-avatar">
              {person.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("")}
            </div>
            <div>
              <strong>{person.fullName}</strong>
              <span>{person.rank} · {person.position}</span>
              <div>
                <span className="unit-code">{person.unit}</span>
                <span className="mono">{person.taxId}</span>
              </div>
            </div>
          </section>

          {person.flags.length > 0 && (
            <div className={`validation-warning ${
              person.flags.includes("СЗЧ") ? "validation-danger" : ""
            }`}>
              <strong>Зверніть увагу</strong>
              <span>Поточний статус: {person.flags.join(", ")}. Перевірте право на виплату.</span>
            </div>
          )}
          {latest?.status === "processed" && (
            <div className="validation-warning validation-alert">
              <strong>Є опрацьований запис!!!</strong>
              <span>
                Рапорт № {latest.reportNumber} від {formatDate(latest.reportDate)}.
                Система не блокує повторний запис із іншим рапортом.
              </span>
            </div>
          )}

          <div className="form-section">
            <div className="form-section-heading">
              <h3>Підстава</h3>
              {aidKind === "material" && bases.length < 3 && (
                <button
                  type="button"
                  className="add-basis-button"
                  onClick={() => setBases((current) => [...current, ""])}
                  aria-label="Додати ще одну підставу"
                  title="Додати ще одну підставу"
                >
                  <Icon name="plus" />
                </button>
              )}
            </div>
            {aidKind === "material" && (
              <div className="basis-fields">
                {bases.map((basis, index) => {
                  const inputId = `basis-${index}`;
                  return (
                    <div className="form-field basis-field" key={index}>
                      <label htmlFor={inputId}>
                        {index === 0
                          ? "Текст підстави"
                          : `Додаткова підстава ${index + 1}`}
                      </label>
                      <input
                        id={inputId}
                        name={`material-basis-${index + 1}`}
                        value={basis}
                        onChange={(event) => {
                        setBases((current) =>
                          current.map((value, valueIndex) =>
                            valueIndex === index ? event.target.value : value
                          )
                            );
                          }}
                        placeholder="Введіть текст підстави"
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="report-details-grid">
              <div className={`form-field ${errors.reportNumber ? "field-error" : ""}`}>
                <div className="report-number-label">
                  <label htmlFor="report-number">Номер рапорту <b>*</b></label>
                  <span className="increment-badge-wrap">
                    <button
                      type="button"
                      className={`increment-badge ${incrementReport ? "is-active" : ""}`}
                      aria-pressed={incrementReport}
                      aria-label={`Автоматичний наступний номер: ${
                        incrementReport ? "увімкнено" : "вимкнено"
                      }`}
                      onClick={toggleIncrement}
                    >
                      +1
                    </button>
                    <span className="increment-tooltip" role="tooltip">
                      Зберігати останній введений номер рапорту та підставляти
                      наступний номер +1.
                    </span>
                  </span>
                </div>
                <input
                  id="report-number"
                  autoFocus={aidKind !== "material"}
                  value={reportNumber}
                  onChange={(event) => setReportNumber(event.target.value)}
                  onBlur={() =>
                    setReportNumber((current) =>
                      normalizeManualReportNumber(current)
                    )}
                  inputMode="numeric"
                />
                {errors.reportNumber && <small>{errors.reportNumber}</small>}
              </div>
              <label className={errors.reportDate ? "field-error" : ""}>
                <span>Дата рапорту <b>*</b></span>
                <input
                  type="date"
                  value={reportDate}
                  max={today()}
                  onChange={(event) => setReportDate(event.target.value)}
                />
                {errors.reportDate && <small>{errors.reportDate}</small>}
              </label>
              <label className={errors.orderDate ? "field-error" : ""}>
                <span>Дата проєкту наказу <b>*</b></span>
                <input
                  type="date"
                  value={formOrderDate}
                  onChange={(event) => setFormOrderDate(event.target.value)}
                />
                {errors.orderDate && <small>{errors.orderDate}</small>}
              </label>
            </div>
          </div>

          <div className="preview-card">
            <span>Попередній перегляд пункту</span>
            <p>{formatOrderPerson(person)}</p>
            <small>
              Підстава: рапорт № {reportNumber || "…"} від{" "}
              {reportDate ? formatDate(reportDate) : "…"}
              {aidKind === "material" &&
                bases.filter((value) => value.trim()).map((value) =>
                  `; ${value.trim()}`
                ).join("")}.
            </small>
          </div>
        </div>
        <footer>
          <button type="submit" className="primary-button">
            <Icon name="check" />
            Опрацювати
          </button>
        </footer>
        </form>
      </aside>
    </>
  );
}
