import { type Profile, profileSchema } from "~/schemas/profile.schema";

export function useProfile() {
  const database = useDatabase();

  async function importProfileFromJson(jsonFile: File): Promise<{ issueList: string[] }> {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(await jsonFile.text());
    } catch {
      return { issueList: ["File is not valid JSON"] };
    }

    const validationResult = profileSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      return { issueList: validationResult.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`) };
    }
    const profile = validationResult.data;

    try {
      await database.transaction(
        "rw",
        [database.classTable, database.userTable, database.activityTypeTable, database.dailySkillTable, database.testVariantTable],
        async () => {
          await database.classTable.bulkPut(profile.class);
          await database.userTable.put(profile.user);
          await database.activityTypeTable.bulkPut(profile.activities);
          await database.dailySkillTable.bulkPut(profile.dailySkills);
          await database.testVariantTable.bulkPut(profile.testVariants);
        }
      );
    } catch (transactionError) {
      const errorMessage = transactionError instanceof Error ? transactionError.message : "Unknown error during import";
      return { issueList: [`Import failed, no changes were saved: ${errorMessage}`] };
    }

    return { issueList: [] };
  }

  async function createProfileExport(): Promise<Profile | undefined> {
    const user = (await database.userTable.toArray())[0];
    if (!user) return undefined;

    return {
      class: await database.classTable.toArray(),
      user,
      activities: await database.activityTypeTable.toArray(),
      dailySkills: await database.dailySkillTable.toArray(),
      testVariants: await database.testVariantTable.toArray()
    };
  }

  return { importProfileFromJson, createProfileExport };
}
