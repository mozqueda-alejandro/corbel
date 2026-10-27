import { z } from "zod";

import { type Student, studentSchema, StudentStatusEnum } from "~/schemas/student.schema";
import { nameSchema } from "~/schemas/utils";

//region Types
type ImportField = "id" | "firstName" | "lastName" | "fullName" | "preferredName" | "email" | "phoneNumber" | "status" | "year";

export type ParsedStudentFields = {
  id?: string
  firstName?: string
  lastName?: string
  preferredName?: string
  email?: string
  phoneNumber?: string
  status?: StudentStatusEnum
  year?: number
};

export type ParsedStudentRow = { rowNumber: number, fields: ParsedStudentFields, issueList: string[] };

export type StudentImportEntry
  = | { kind: "new", rowNumber: number, label: string, student: Student }
    | { kind: "match", rowNumber: number, label: string, matchedBy: string, existingStudent: Student, student: Student, replacementStudent: Student }
    | { kind: "rejected", rowNumber: number, label: string, issueList: string[] };
//endregion

//region Export
export const STUDENT_EXPORT_HEADER_LIST = ["ID", "First Name", "Last Name", "Preferred Name", "Email", "Phone", "Status", "Year"];

export function createStudentExportRowList(studentList: Student[]): string[][] {
  const sortedStudentList = [...studentList].sort((studentA, studentB) =>
    `${studentA.lastName} ${studentA.firstName}`.localeCompare(`${studentB.lastName} ${studentB.firstName}`));

  return [
    STUDENT_EXPORT_HEADER_LIST,
    ...sortedStudentList.map(student => [
      student.id,
      student.firstName,
      student.lastName,
      student.preferredName ?? "",
      student.email ?? "",
      formatPhoneNumber(student.phoneNumber),
      student.status,
      String(student.year)
    ].map(neutralizeCsvFormula))
  ];
}
//endregion

//region Parsing
const HEADER_SYNONYM_MAP: Record<ImportField, string[]> = {
  id: ["id", "studentid", "uuid"],
  firstName: ["firstname", "first", "givenname", "forename", "fname"],
  lastName: ["lastname", "last", "surname", "familyname", "lname"],
  fullName: ["name", "fullname", "studentname", "student"],
  preferredName: ["preferredname", "preferred", "nickname", "goesby", "knownas"],
  email: ["email", "emailaddress", "emailaddr", "mail", "studentemail"],
  phoneNumber: ["phone", "phonenumber", "mobile", "mobilephone", "cell", "cellphone", "cellnumber", "telephone", "tel", "contactnumber"],
  status: ["status", "studentstatus", "enrollmentstatus"],
  year: ["year", "grade", "gradelevel", "classyear", "yearlevel"]
};

const fieldByHeaderKeyMap = new Map<string, ImportField>((Object.entries(HEADER_SYNONYM_MAP) as [ImportField, string[]][])
  .flatMap(([field, synonymList]) => synonymList.map(synonym => [synonym, field] as const)));

const HEADER_SEARCH_ROW_LIMIT = 15;

function getHeaderKey(headerText: string) {
  return headerText.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Picks the row that looks most like a header, so title rows above it are ignored.
function findHeaderRowIndex(cellRowList: string[][]) {
  let bestIndex = -1;
  let bestCount = 1;
  cellRowList.slice(0, HEADER_SEARCH_ROW_LIMIT).forEach((cellRow, index) => {
    const fieldSet = new Set(cellRow.map(cell => fieldByHeaderKeyMap.get(getHeaderKey(cell))).filter(Boolean));
    if (fieldSet.size > bestCount) {
      bestCount = fieldSet.size;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function toTitleCase(text: string) {
  return text.toLowerCase().replace(/(^|[\s\-'.])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toUpperCase());
}

// Names typed entirely in one case are fixed up; mixed case (McDonald, de la Cruz) is left alone.
function normalizeName(rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ");
  return name === name.toLowerCase() || name === name.toUpperCase() ? toTitleCase(name) : name;
}

function splitFullName(fullName: string): { firstName: string, lastName: string } {
  const name = normalizeName(fullName);
  if (name.includes(",")) {
    const [lastName = "", ...firstNameList] = name.split(",");
    return { firstName: firstNameList.join(" ").trim(), lastName: lastName.trim() };
  }
  const [firstName = "", ...lastNameList] = name.split(" ");
  return { firstName, lastName: lastNameList.join(" ") };
}

const STATUS_ALIAS_MAP: Record<string, StudentStatusEnum> = {
  active: StudentStatusEnum.Active,
  a: StudentStatusEnum.Active,
  enrolled: StudentStatusEnum.Active,
  current: StudentStatusEnum.Active,
  inactive: StudentStatusEnum.Inactive,
  i: StudentStatusEnum.Inactive,
  withdrawn: StudentStatusEnum.Inactive,
  dropped: StudentStatusEnum.Inactive,
  graduated: StudentStatusEnum.Graduated,
  graduate: StudentStatusEnum.Graduated,
  grad: StudentStatusEnum.Graduated,
  g: StudentStatusEnum.Graduated,
  alumni: StudentStatusEnum.Graduated,
  alumnus: StudentStatusEnum.Graduated
};

const YEAR_WORD_MAP: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  freshman: 1,
  sophomore: 2,
  junior: 3,
  senior: 4
};

function parseYear(yearText: string): number | undefined {
  const digitMatch = /\d+/.exec(yearText);
  if (digitMatch) return Number(digitMatch[0]);
  const wordMatch = /[a-z]+/.exec(yearText.toLowerCase());
  return wordMatch ? YEAR_WORD_MAP[wordMatch[0]] : undefined;
}

function parseStudentRow(cellList: string[], fieldByColumnList: (ImportField | undefined)[], rowNumber: number): ParsedStudentRow {
  const textByField = new Map<ImportField, string>();
  fieldByColumnList.forEach((field, columnIndex) => {
    const text = restoreCsvFormula((cellList[columnIndex] ?? "").trim());
    if (field && text && !textByField.has(field)) textByField.set(field, text);
  });

  const fields: ParsedStudentFields = {};
  const issueList: string[] = [];

  const idText = textByField.get("id");
  if (idText && z.uuid().safeParse(idText).success) fields.id = idText.toLowerCase();

  let firstNameText = textByField.get("firstName");
  let lastNameText = textByField.get("lastName");
  const fullNameText = textByField.get("fullName");
  if (!firstNameText && !lastNameText && fullNameText) {
    const splitName = splitFullName(fullNameText);
    firstNameText = splitName.firstName;
    lastNameText = splitName.lastName;
  }

  if (!firstNameText && !lastNameText) issueList.push("Missing name");
  const nameFieldList = [
    ["firstName", "first name", firstNameText],
    ["lastName", "last name", lastNameText],
    ["preferredName", "preferred name", textByField.get("preferredName")]
  ] as const;
  for (const [field, label, rawName] of nameFieldList) {
    if (!rawName) continue;
    const nameText = normalizeName(rawName);
    const nameResult = nameSchema.safeParse(nameText);
    if (nameResult.success) fields[field] = nameText;
    else issueList.push(`Invalid ${label} "${rawName}": ${nameResult.error.issues[0]?.message ?? "not allowed"}`);
  }

  const emailText = textByField.get("email");
  if (emailText) {
    const email = normalizeEmail(emailText);
    if (z.email().safeParse(email).success) fields.email = email;
    else issueList.push(`Invalid email "${emailText}"`);
  }

  const phoneText = textByField.get("phoneNumber");
  if (phoneText) {
    const phoneNumber = normalizePhoneNumber(phoneText);
    if (phoneNumber) fields.phoneNumber = phoneNumber;
    else issueList.push(`Invalid phone number "${phoneText}"`);
  }

  const statusText = textByField.get("status");
  if (statusText) {
    const status = STATUS_ALIAS_MAP[statusText.toLowerCase().replace(/[^a-z]/g, "")];
    if (status) fields.status = status;
    else issueList.push(`Unknown status "${statusText}"`);
  }

  const yearText = textByField.get("year");
  if (yearText) {
    const year = parseYear(yearText);
    if (year !== undefined && year >= 0 && year <= 10) fields.year = year;
    else issueList.push(`Invalid year "${yearText}"`);
  }

  return { rowNumber, fields, issueList };
}

// Columns are matched by header name in any order; unrecognised columns and blank rows are ignored.
export function parseStudentCsv(cellRowList: string[][]): { rowList: ParsedStudentRow[], issue?: string } {
  const headerRowIndex = findHeaderRowIndex(cellRowList);
  if (headerRowIndex < 0) {
    return { rowList: [], issue: "No student columns found. Include headers such as First Name, Last Name, Email and Phone." };
  }

  const fieldByColumnList = cellRowList[headerRowIndex]!.map(header => fieldByHeaderKeyMap.get(getHeaderKey(header)));
  const rowList = cellRowList
    .map((cellList, index) => ({ cellList, rowNumber: index + 1 }))
    .slice(headerRowIndex + 1)
    .filter(({ cellList }) => cellList.some(cell => cell.trim() !== ""))
    .map(({ cellList, rowNumber }) => parseStudentRow(cellList, fieldByColumnList, rowNumber));

  return { rowList };
}
//endregion

//region Planning
function getFullName(student: { firstName?: string, lastName?: string }) {
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
}

function findExistingStudent(fields: ParsedStudentFields, existingStudentList: Student[]) {
  const fullName = getFullName(fields).toLowerCase();
  const matchRuleList: [string, (student: Student) => boolean][] = [
    ["ID", student => !!fields.id && student.id === fields.id],
    ["email", student => !!fields.email && student.email?.toLowerCase() === fields.email],
    ["phone number", student => !!fields.phoneNumber && student.phoneNumber === fields.phoneNumber],
    ["name", student => !!fullName && getFullName(student).toLowerCase() === fullName]
  ];

  for (const [matchedBy, isMatch] of matchRuleList) {
    const existingStudent = existingStudentList.find(isMatch);
    if (existingStudent) return { existingStudent, matchedBy };
  }
  return undefined;
}

// Decides what each parsed row becomes: a new student, an update to an existing one, or a rejection.
// A match carries both outcomes: `student` merges the file into the old record, `replacementStudent` discards it.
// Existing students are matched by ID, then email, phone and finally full name. Nothing is saved here.
export function planStudentImport(rowList: ParsedStudentRow[], existingStudentList: Student[]): StudentImportEntry[] {
  // Who holds each email and phone, updated as rows are accepted so duplicates inside the file are caught.
  const ownerByEmail = new Map(existingStudentList.filter(student => student.email).map(student => [student.email!.toLowerCase(), student]));
  const ownerByPhone = new Map(existingStudentList.filter(student => student.phoneNumber).map(student => [student.phoneNumber!, student]));
  const acceptedRowByStudentId = new Map<string, number>();

  return rowList.map((row): StudentImportEntry => {
    const { fields, rowNumber } = row;
    const label = getFullName(fields) || `Row ${rowNumber}`;
    if (row.issueList.length > 0) return { kind: "rejected", rowNumber, label, issueList: row.issueList };

    const match = findExistingStudent(fields, existingStudentList);
    const existingStudent = match?.existingStudent;

    // Blank cells keep the existing value, so a sparse file can't wipe out contact details.
    const providedFields = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const newStudentDefaults = { firstName: "", lastName: "", status: StudentStatusEnum.Active, year: 0 };
    const candidate = existingStudent
      ? { ...existingStudent, ...providedFields, id: existingStudent.id }
      : { ...newStudentDefaults, ...providedFields, id: fields.id ?? crypto.randomUUID() };

    const candidateResult = studentSchema.safeParse(candidate);
    if (!candidateResult.success) {
      return { kind: "rejected", rowNumber, label, issueList: candidateResult.error.issues.map(issue => issue.message) };
    }
    const student = candidateResult.data;

    const issueList: string[] = [];
    const earlierRowNumber = acceptedRowByStudentId.get(student.id);
    if (earlierRowNumber !== undefined) issueList.push(`Same student as row ${earlierRowNumber}`);

    const emailOwner = student.email ? ownerByEmail.get(student.email.toLowerCase()) : undefined;
    if (emailOwner && emailOwner.id !== student.id) issueList.push(`Email ${student.email} already belongs to ${getFullName(emailOwner)}`);
    const phoneOwner = student.phoneNumber ? ownerByPhone.get(student.phoneNumber) : undefined;
    if (phoneOwner && phoneOwner.id !== student.id) issueList.push(`Phone ${formatPhoneNumber(student.phoneNumber)} already belongs to ${getFullName(phoneOwner)}`);
    if (issueList.length > 0) return { kind: "rejected", rowNumber, label, issueList };

    acceptedRowByStudentId.set(student.id, rowNumber);
    if (student.email) ownerByEmail.set(student.email.toLowerCase(), student);
    if (student.phoneNumber) ownerByPhone.set(student.phoneNumber, student);

    if (!match) return { kind: "new", rowNumber, label: getFullName(student), student };

    // Replacing starts from a blank student, so nothing from the old record survives except the ID that
    // sessions and attendance refer to.
    const replacementResult = studentSchema.safeParse({ ...newStudentDefaults, ...providedFields, id: match.existingStudent.id });
    if (!replacementResult.success) {
      return { kind: "rejected", rowNumber, label, issueList: replacementResult.error.issues.map(issue => issue.message) };
    }
    return {
      kind: "match",
      rowNumber,
      label: getFullName(student),
      matchedBy: match.matchedBy,
      existingStudent: match.existingStudent,
      student,
      replacementStudent: replacementResult.data
    };
  });
}
//endregion
