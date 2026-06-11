import { formatFullName, fullNameToDative } from "./dative";
import type { Person, SedoReport } from "./types";

const historicalNames = [
  "Шевченко Тарас Григорович",
  "Франко Іван Якович",
  "Сковорода Григорій Савич",
  "Грушевський Михайло Сергійович",
  "Хмельницький Богдан-Зіновій Михайлович",
  "Мазепа Іван Степанович",
  "Орлик Пилип Степанович",
  "Коновалець Євген Михайлович",
  "Петлюра Симон Васильович",
  "Бандера Степан Андрійович",
  "Шухевич Роман Йосипович",
  "Котляревський Іван Петрович",
  "Куліш Пантелеймон Олександрович",
  "Драгоманов Михайло Петрович",
  "Лисенко Микола Віталійович",
  "Леонтович Микола Дмитрович",
  "Курбас Олександр-Зенон Степанович",
  "Крушельницька Соломія Амвросіївна",
  "Косач Лариса Петрівна",
  "Кобилянська Ольга Юліанівна",
  "Старицький Михайло Петрович",
  "Карпенко-Карий Іван Карпович",
  "Нечуй-Левицький Іван Семенович",
  "Коцюбинський Михайло Михайлович",
  "Чубинський Павло Платонович",
  "Вернадський Володимир Іванович",
  "Сікорський Ігор Іванович",
  "Корольов Сергій Павлович",
  "Патон Євген Оскарович",
  "Амосов Микола Михайлович",
  "Кондратюк Юрій Васильович",
  "Аркас Микола Миколайович",
  "Тичина Павло Григорович",
  "Рильський Максим Тадейович",
  "Хвильовий Микола Григорович",
  "Косинка Григорій Михайлович",
  "Довженко Олександр Петрович",
  "Яновський Юрій Іванович",
  "Губенко Павло Михайлович",
  "Стус Василь Семенович",
  "Симоненко Василь Андрійович",
  "Івасюк Володимир Михайлович",
  "Білокур Катерина Василівна",
  "Примаченко Марія Оксентіївна",
  "Лобановський Валерій Васильович",
  "Биков Леонід Федорович",
  "Каденюк Леонід Костянтинович",
  "Костенко Ліна Василівна",
  "Чорновіл В'ячеслав Максимович",
  "Лук'яненко Левко Григорович",
];
const ranks = [
  "солдат", "старший солдат", "молодший сержант", "сержант",
  "старший сержант", "лейтенант", "старший лейтенант", "капітан",
  "майор", "підполковник",
];
const positions = [
  "стрілець", "старший водій", "командир відділення",
  "головний сержант взводу", "командир взводу",
  "офіцер відділення персоналу", "начальник служби",
  "заступник командира роти", "командир роти", "офіцер штабу",
];
export const unitNames = ["1МБ", "2МБ", "3МБ", "САДН", "МПБ"];

const generatedPeople: Person[] = Array.from({ length: 50 }, (_, index) => {
  const rank = ranks[index % ranks.length];
  const category = index % 10 >= 5
    ? "Офіцерський"
    : index % 10 >= 2
      ? "Сержантський"
      : "Рядовий";

  return {
    id: `person-${String(index + 1).padStart(3, "0")}`,
    taxId: `${3100000000 + index * 7919}`.slice(0, 10),
    unit: unitNames[index % unitNames.length],
    rank,
    fullName: formatFullName(historicalNames[index]),
    fullNameDative: fullNameToDative(historicalNames[index]),
    position: positions[index % positions.length],
    category,
    flags: index === 7
      ? ["Відрядження"]
      : index === 18
        ? ["Відпустка"]
        : index === 31
          ? ["Шпиталь"]
          : [],
  };
});

export const people: Person[] = [
  ...generatedPeople,
  {
    id: "person-051",
    taxId: "3100395950",
    unit: "1МБ",
    rank: "солдат",
    fullName: formatFullName("Янукович Віктор Федорович"),
    fullNameDative: formatFullName("Януковичу Віктору Федоровичу"),
    position: "стрілець",
    category: "Рядовий",
    flags: ["СЗЧ"],
  },
  {
    id: "person-052",
    taxId: "3100403869",
    unit: "2МБ",
    rank: "солдат",
    fullName: formatFullName("Азаров Микола Янович"),
    fullNameDative: formatFullName("Азарову Миколі Яновичу"),
    position: "стрілець",
    category: "Рядовий",
    flags: ["СЗЧ"],
  },
];

const reportDate = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date.toISOString().slice(0, 10);
};

const sedoBasisExamples = [
  ["копія довідки про обставини поранення № 1245 від 11.05.2026, видана в/ч А0000"],
  [
    "копія свідоцтва про смерть матері від 17.02.2026",
    "копія свідоцтва про народження",
  ],
  ["копія свідоцтва про народження дитини від 01.04.2026"],
  ["копія виписки із медичної карти стаціонарного хворого від 25.04.2025"],
  ["копія довідки про склад сім'ї від 20.05.2026"],
  [
    "копія посвідчення особи з інвалідністю внаслідок війни",
    "копія довідки МСЕК від 14.03.2026",
  ],
];

const generatedSedoReports: SedoReport[] = Array.from(
  { length: 24 },
  (_, index) => {
    const person = people[(index * 2 + 3) % people.length];
    const date = reportDate((index % 8) + 1);
    return {
      id: `sedo-${String(index + 1).padStart(3, "0")}`,
      personId: person.id,
      number: `${1240 + index}/р`,
      date,
      registeredAt: `${date}T${String(8 + (index % 9)).padStart(2, "0")}:${
        String((index * 7) % 60).padStart(2, "0")
      }:00`,
      correspondent: person.fullName,
      subject: "Рапорт про виплату грошової допомоги для оздоровлення",
      materialBases: sedoBasisExamples[index % sedoBasisExamples.length],
    };
  },
);

const yanukovychReportDate = reportDate(1);
const azarovReportDate = reportDate(2);

export const sedoReports: SedoReport[] = [
  ...generatedSedoReports,
  {
    id: "sedo-025",
    personId: "person-051",
    number: "1264/р",
    date: yanukovychReportDate,
    registeredAt: `${yanukovychReportDate}T10:15:00`,
    correspondent: formatFullName("Янукович Віктор Федорович"),
    subject: "Рапорт про виплату грошової допомоги для оздоровлення",
    materialBases: sedoBasisExamples[0],
  },
  {
    id: "sedo-026",
    personId: "person-052",
    number: "1265/р",
    date: azarovReportDate,
    registeredAt: `${azarovReportDate}T10:30:00`,
    correspondent: formatFullName("Азаров Микола Янович"),
    subject: "Рапорт про виплату грошової допомоги для оздоровлення",
    materialBases: sedoBasisExamples[1],
  },
];

export const personById = new Map(people.map((person) => [person.id, person]));
export const sedoById = new Map(sedoReports.map((report) => [report.id, report]));
