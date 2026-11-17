import { z } from "zod";

import { studentSchema } from "~/schemas/student.schema";

// Only the file's `students` list is read; anything else in it is ignored.
const studentImportSchema = z.object({
  students: z.array(studentSchema).min(1, "The file has no students")
});

export function useStudentImport() {
  const database = useDatabase();

  async function importStudentsFromJson(jsonFile: File): Promise<{ issueList: string[] }> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(await jsonFile.text());
    } catch {
      return { issueList: ["File is not valid JSON"] };
    }

    const validationResult = studentImportSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      return { issueList: validationResult.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`) };
    }

    try {
      await database.studentTable.bulkPut(validationResult.data.students);
    } catch (importError) {
      const errorMessage = importError instanceof Error ? importError.message : "Unknown error during import";
      return { issueList: [`Import failed, no changes were saved: ${errorMessage}`] };
    }

    return { issueList: [] };
  }

  return { importStudentsFromJson };
}
