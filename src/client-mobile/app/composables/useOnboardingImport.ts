import { onboardingImportSchema } from "~/schemas/onboarding-import.schema";

export function useOnboardingImport() {
  const database = useDatabase();

  async function importOnboardingDataFromJson(jsonFile: File): Promise<{ issueList: string[] }> {
    const fileText = await jsonFile.text();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fileText);
    } catch {
      return { issueList: ["File is not valid JSON"] };
    }

    const validationResult = onboardingImportSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      return {
        issueList: validationResult.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`)
      };
    }

    const importedData = validationResult.data;

    try {
      await database.transaction(
        "rw",
        [
          database.classTable,
          database.userTable,
          database.studentTable,
          database.activityTypeTable,
          database.dailySkillTable,
          database.testVariantTable,
          database.sessionTable
        ],
        async () => {
          for (const importedClass of importedData.class) {
            await database.classTable.put(importedClass);
          }

          await database.userTable.put(importedData.user);

          for (const student of importedData.students) {
            await database.studentTable.put(student);
          }

          for (const activity of importedData.activities) {
            await database.activityTypeTable.put(activity);
          }

          for (const dailySkill of importedData.dailySkills) {
            await database.dailySkillTable.put(dailySkill);
          }

          for (const testVariant of importedData.testVariants) {
            await database.testVariantTable.put(testVariant);
          }

          for (const session of importedData.sessions) {
            await database.sessionTable.put(session);
          }
        }
      );
    } catch (transactionError) {
      const errorMessage = transactionError instanceof Error ? transactionError.message : "Unknown error during import";
      return { issueList: [`Import failed, no changes were saved: ${errorMessage}`] };
    }

    return { issueList: [] };
  }

  return { importOnboardingDataFromJson };
}
