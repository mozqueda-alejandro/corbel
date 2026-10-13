// Minimal RFC 4180 CSV reader/writer. Handles quoted fields with embedded delimiters, quotes and newlines,
// CRLF or LF line endings, a UTF-8 BOM, and the semicolon/tab delimiters some spreadsheet locales write.

const CANDIDATE_DELIMITER_LIST = [",", ";", "\t"];

function detectDelimiter(text: string): string {
  const countByDelimiter = new Map(CANDIDATE_DELIMITER_LIST.map(delimiter => [delimiter, 0]));
  let isInQuotes = false;

  for (const character of text) {
    if (character === "\"") isInQuotes = !isInQuotes;
    else if (!isInQuotes && (character === "\n" || character === "\r")) break;
    else if (!isInQuotes && countByDelimiter.has(character)) countByDelimiter.set(character, countByDelimiter.get(character)! + 1);
  }

  let bestDelimiter = ",";
  for (const [delimiter, count] of countByDelimiter) {
    if (count > countByDelimiter.get(bestDelimiter)!) bestDelimiter = delimiter;
  }
  return bestDelimiter;
}

export function parseCsv(csvText: string): string[][] {
  const text = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;
  const delimiter = detectDelimiter(text);
  const rowList: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isInQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;

    if (isInQuotes) {
      if (character !== "\"") {
        field += character;
      } else if (text[index + 1] === "\"") {
        field += "\"";
        index++;
      } else {
        isInQuotes = false;
      }
    } else if (character === "\"" && field === "") {
      isInQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(field);
      rowList.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rowList.push(row);
  }
  return rowList;
}

function escapeCsvField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

export function stringifyCsv(rowList: string[][]): string {
  return rowList.map(row => row.map(escapeCsvField).join(",")).join("\r\n") + "\r\n";
}

// Spreadsheets run cells that start with these characters as formulas (CSV injection), so exports
// prefix them with an apostrophe, and imports remove it again.
const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

export function neutralizeCsvFormula(value: string): string {
  return FORMULA_TRIGGER_PATTERN.test(value) ? `'${value}` : value;
}

export function restoreCsvFormula(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}
