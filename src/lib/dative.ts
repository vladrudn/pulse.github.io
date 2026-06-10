const capitalize = (value: string) =>
  value ? `${value[0].toLocaleUpperCase("uk")}${value.slice(1)}` : value;

const inflectHyphenated = (value: string, transform: (part: string) => string) =>
  value.split("-").map(transform).join("-");

const inflectWord = (value: string) => {
  const lower = value.toLocaleLowerCase("uk");

  const replace = (next: string) => capitalize(next);

  if (lower.includes("-")) {
    return inflectHyphenated(value, inflectWord);
  }

  if (lower.endsWith("ович")) return replace(`${lower.slice(0, -4)}овичу`);
  if (lower.endsWith("евич")) return replace(`${lower.slice(0, -4)}евичу`);
  if (lower.endsWith("йович")) return replace(`${lower.slice(0, -5)}йовичу`);
  if (lower.endsWith("івна")) return replace(`${lower.slice(0, -4)}івні`);
  if (lower.endsWith("ївна")) return replace(`${lower.slice(0, -4)}ївні`);
  if (lower === "ольга") return replace("ользі");
  if (lower.endsWith("енко")) return replace(`${lower.slice(0, -4)}енку`);
  if (lower.endsWith("ко")) return replace(`${lower.slice(0, -2)}ку`);
  if (lower.endsWith("ська")) return replace(`${lower.slice(0, -4)}ській`);
  if (lower.endsWith("цька")) return replace(`${lower.slice(0, -4)}цькій`);
  if (lower.endsWith("зька")) return replace(`${lower.slice(0, -4)}зькій`);
  if (lower.endsWith("жка")) return replace(`${lower.slice(0, -3)}жці`);
  if (lower.endsWith("чка")) return replace(`${lower.slice(0, -3)}чці`);
  if (lower.endsWith("ський")) return replace(`${lower.slice(0, -5)}ському`);
  if (lower.endsWith("цький")) return replace(`${lower.slice(0, -5)}цькому`);
  if (lower.endsWith("зький")) return replace(`${lower.slice(0, -5)}зькому`);
  if (lower.endsWith("жий")) return replace(`${lower.slice(0, -3)}жому`);
  if (lower.endsWith("чий")) return replace(`${lower.slice(0, -3)}чому`);
  if (lower.endsWith("ий")) return replace(`${lower.slice(0, -2)}ому`);
  if (lower.endsWith("ій")) return replace(`${lower.slice(0, -2)}ію`);
  if (lower.endsWith("ія")) return replace(`${lower.slice(0, -2)}ії`);
  if (lower.endsWith("я")) return replace(`${lower.slice(0, -1)}і`);
  if (lower.endsWith("а")) return replace(`${lower.slice(0, -1)}і`);
  if (lower.endsWith("о")) return replace(`${lower.slice(0, -1)}у`);
  if (lower.endsWith("ь")) return replace(`${lower.slice(0, -1)}ю`);

  return replace(`${lower}у`);
};

export const rankToDative: Record<string, string> = {
  "солдат": "солдату",
  "старший солдат": "старшому солдату",
  "молодший сержант": "молодшому сержанту",
  "сержант": "сержанту",
  "старший сержант": "старшому сержанту",
  "лейтенант": "лейтенанту",
  "старший лейтенант": "старшому лейтенанту",
  "капітан": "капітану",
  "майор": "майору",
  "підполковник": "підполковнику",
};

export const positionToDative: Record<string, string> = {
  "стрілець": "стрільцю",
  "старший водій": "старшому водієві",
  "командир відділення": "командиру відділення",
  "головний сержант взводу": "головному сержанту взводу",
  "командир взводу": "командиру взводу",
  "офіцер відділення персоналу": "офіцеру відділення персоналу",
  "начальник служби": "начальнику служби",
  "заступник командира роти": "заступнику командира роти",
  "командир роти": "командиру роти",
  "офіцер штабу": "офіцеру штабу",
};

export const fullNameToDative = (fullName: string) => {
  const parts = fullName.split(/\s+/).filter(Boolean);
  const patronymic = parts.at(-1)?.toLocaleLowerCase("uk") || "";
  const isFemale = patronymic.endsWith("івна") || patronymic.endsWith("ївна");

  return parts
    .map((part, index) => {
      if (index !== 0 || !isFemale) return inflectWord(part);

      const surname = part.toLocaleLowerCase("uk");
      return surname.endsWith("а") || surname.endsWith("я")
        ? inflectWord(part)
        : part;
    })
    .join(" ");
};
