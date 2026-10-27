import { z } from "zod";

import { testSkillSchema } from "~/schemas/test-skill.schema";
import { type TestVariant, testVariantSchema } from "~/schemas/test-variant.schema";

//region Types
export type TestImportEntry
  = | { kind: "new", rowNumber: number, label: string, test: TestVariant }
    | { kind: "match", rowNumber: number, label: string, matchedBy: string, existingTest: TestVariant, test: TestVariant }
    | { kind: "rejected", rowNumber: number, label: string, issueList: string[] };
//endregion

//region Export
export function createTestExportList(testVariantList: TestVariant[]): TestVariant[] {
  return [...testVariantList].sort((testA, testB) => testA.name.localeCompare(testB.name));
}
//endregion

//region Parsing
// IDs are optional in a file: a test or skill without one is matched by name, or created.
const importTestSchema = testVariantSchema.extend({
  id: z.uuid().optional(),
  skills: z.array(testSkillSchema.extend({ id: z.uuid().optional() })).min(1)
});

function formatIssue(issue: z.core.$ZodIssue) {
  const [first, skillIndex, field] = issue.path;
  if (first === "skills" && typeof skillIndex === "number") {
    return `Skill ${skillIndex + 1}${field === undefined ? "" : ` ${String(field)}`}: ${issue.message}`;
  }
  return issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
}

function getRawName(rawTest: unknown) {
  const name = (rawTest as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name.trim() : "";
}
//endregion

//region Planning
// Decides what each test in the file becomes: a new test, an update to an existing one, or a rejection.
// Existing tests are matched by ID, then by name. Nothing is saved here.
export function planTestImport(fileText: string, existingTestList: TestVariant[]): { entryList: TestImportEntry[], issue?: string } {
  let rawTestList: unknown;
  try {
    rawTestList = JSON.parse(fileText);
  } catch {
    return { entryList: [], issue: "The file isn't valid JSON." };
  }
  if (!Array.isArray(rawTestList) || rawTestList.length === 0) {
    return { entryList: [], issue: "The file should contain a list of tests." };
  }

  const ownerByName = new Map(existingTestList.map(test => [test.name.toLowerCase(), test.id]));
  const acceptedRowByTestId = new Map<string, number>();

  const entryList = rawTestList.map((rawTest: unknown, index): TestImportEntry => {
    const rowNumber = index + 1;
    const label = getRawName(rawTest) || `Test ${rowNumber}`;

    const parseResult = importTestSchema.safeParse(rawTest);
    if (!parseResult.success) return { kind: "rejected", rowNumber, label, issueList: parseResult.error.issues.map(formatIssue) };
    const parsedTest = parseResult.data;

    const lowerName = parsedTest.name.toLowerCase();
    const matchedById = parsedTest.id ? existingTestList.find(test => test.id === parsedTest.id) : undefined;
    const existingTest = matchedById ?? existingTestList.find(test => test.name.toLowerCase() === lowerName);
    const matchedBy = matchedById ? "ID" : "name";

    // A skill keeps its ID from the file, else from the skill with the same name, so scores stay attached to it.
    const existingSkillIdByName = new Map(existingTest?.skills.map(skill => [skill.name.toLowerCase(), skill.id]));
    const test: TestVariant = {
      id: existingTest?.id ?? parsedTest.id ?? crypto.randomUUID(),
      name: parsedTest.name,
      skills: parsedTest.skills.map(skill => ({
        ...skill,
        id: skill.id ?? existingSkillIdByName.get(skill.name.toLowerCase()) ?? crypto.randomUUID()
      }))
    };

    const issueList: string[] = [];
    if (new Set(test.skills.map(skill => skill.id)).size !== test.skills.length) issueList.push("Two skills share the same ID or name.");
    const earlierRowNumber = acceptedRowByTestId.get(test.id);
    if (earlierRowNumber !== undefined) issueList.push(`Same test as row ${earlierRowNumber}`);
    const nameOwnerId = ownerByName.get(lowerName);
    if (nameOwnerId && nameOwnerId !== test.id) issueList.push(`Name "${test.name}" is already used by another test`);
    if (issueList.length > 0) return { kind: "rejected", rowNumber, label, issueList };

    acceptedRowByTestId.set(test.id, rowNumber);
    ownerByName.set(lowerName, test.id);
    return existingTest
      ? { kind: "match", rowNumber, label: test.name, matchedBy, existingTest, test }
      : { kind: "new", rowNumber, label: test.name, test };
  });

  return { entryList };
}
//endregion
