import builtInDailySkillList from "~/data/built-in-daily-skills.json";
import builtInTestList from "~/data/built-in-tests.json";
import { type Class, classSchema } from "~/schemas/class.schema";
import { dailySkillSchema } from "~/schemas/daily-skill.schema";
import { testVariantSchema } from "~/schemas/test-variant.schema";
import { type User, userSchema } from "~/schemas/user.schema";

export type OnboardingProfile = {
  firstName: string
  lastName: string
  className: string
  startDate: Date
  endDate: Date
};

// Sets up the first user and class together with the tests and daily skills that ship with the app.
// Everything is written in one transaction, so a failure leaves the app still waiting to be set up.
export function useOnboarding() {
  const database = useDatabase();

  async function completeOnboarding(profile: OnboardingProfile): Promise<{ issueList: string[] }> {
    const userResult = userSchema.safeParse({
      id: crypto.randomUUID(),
      firstName: profile.firstName,
      lastName: profile.lastName
    } satisfies User);
    const classResult = classSchema.safeParse({
      id: crypto.randomUUID(),
      name: profile.className,
      startDate: profile.startDate,
      endDate: profile.endDate
    } satisfies Class);
    if (!userResult.success || !classResult.success) {
      const issueList = [userResult, classResult].flatMap(result => (result.success ? [] : result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`)));
      return { issueList };
    }

    try {
      await database.transaction("rw", [database.userTable, database.classTable, database.dailySkillTable, database.testVariantTable], async () => {
        await database.userTable.put(userResult.data);
        await database.classTable.put(classResult.data);
        await database.dailySkillTable.bulkPut(builtInDailySkillList.map(dailySkill => dailySkillSchema.parse(dailySkill)));
        await database.testVariantTable.bulkPut(builtInTestList.map(test => testVariantSchema.parse(test)));
      });
    } catch (transactionError) {
      const errorMessage = transactionError instanceof Error ? transactionError.message : "Unknown error during setup";
      return { issueList: [`Setup failed, no changes were saved: ${errorMessage}`] };
    }

    return { issueList: [] };
  }

  return { completeOnboarding };
}
