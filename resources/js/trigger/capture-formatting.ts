export type SqlBinding = {
  position: number;
  column: string | null;
  value: unknown;
};

export function interpolateSql(sql: string, bindings: SqlBinding[]): string {
  const values = new Map(bindings.map((binding) => [binding.position, binding.value]));
  let bindingPosition = 0;
  let result = "";
  let index = 0;
  let quote: "'" | "\"" | "`" | "]" | null = null;
  let dollarQuote: string | null = null;
  let lineComment = false;
  let blockComment = false;

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      result += character;
      index += 1;
      if (character === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      result += character;
      index += 1;
      if (character === "*" && next === "/") {
        result += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarQuote !== null) {
      if (sql.startsWith(dollarQuote, index)) {
        result += dollarQuote;
        index += dollarQuote.length;
        dollarQuote = null;
      } else {
        result += character;
        index += 1;
      }
      continue;
    }

    if (quote !== null) {
      result += character;
      index += 1;

      if (character === "\\" && quote !== "]" && index < sql.length) {
        result += sql[index];
        index += 1;
      } else if (character === quote) {
        if (sql[index] === quote) {
          result += sql[index];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === "-" && next === "-") {
      result += "--";
      index += 2;
      lineComment = true;
      continue;
    }

    if (character === "/" && next === "*") {
      result += "/*";
      index += 2;
      blockComment = true;
      continue;
    }

    if (character === "'" || character === "\"" || character === "`") {
      result += character;
      quote = character;
      index += 1;
      continue;
    }

    if (character === "[") {
      result += character;
      quote = "]";
      index += 1;
      continue;
    }

    if (character === "$") {
      const match = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarQuote = match[0];
        result += dollarQuote;
        index += dollarQuote.length;
        continue;
      }
    }

    if (character === "?" && !isJsonOperator(sql, index)) {
      result += values.has(bindingPosition) ? sqlLiteral(values.get(bindingPosition)) : character;
      bindingPosition += 1;
      index += 1;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

function sqlLiteral(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return String(value);

  let stringValue: string;
  if (typeof value === "string") {
    stringValue = value;
  } else {
    try {
      stringValue = JSON.stringify(value) ?? String(value);
    } catch {
      stringValue = String(value);
    }
  }

  return `'${stringValue.replaceAll("'", "''")}'`;
}

function isJsonOperator(sql: string, index: number): boolean {
  if (sql[index + 1] === "|" || sql[index + 1] === "&") return true;

  const before = sql.slice(0, index).match(/\S(?=\s*$)/)?.[0];
  const after = sql.slice(index + 1).match(/^\s*(\S)/)?.[1];

  return before !== undefined
    && /[\w)\]"'`]/.test(before)
    && after !== undefined
    && /[\w$?"'`[(]/.test(after);
}
