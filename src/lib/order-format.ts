import type { Person } from "./types";
import { positionToDative, rankToDative } from "./dative";

export const AID_ORDER_HEADING =
  "Виплатити грошову допомогу на оздоровлення за 2026 рік у розмірі місячного грошового забезпечення:";

const capitalize = (value: string) =>
  value ? `${value[0].toLocaleUpperCase("uk")}${value.slice(1)}` : value;

export const formatOrderPerson = (person: Person) => {
  const [surname = "", ...otherNames] = person.fullNameDative.split(/\s+/);
  const formattedName = [
    surname.toLocaleUpperCase("uk"),
    ...otherNames,
  ].join(" ");

  return `${capitalize(rankToDative[person.rank] || person.rank)} ${formattedName}, ${
    positionToDative[person.position] || person.position
  }.`;
};
