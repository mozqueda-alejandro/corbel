import { onboardingImportSchema } from "~/schemas/onboarding-import.schema";

export function useOnboardingImport() {
  const { saveUser } = useUserRepository();
  const { saveClass } = useClassRepository();

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

    const { class: importedClassList, user: importedUser } = validationResult.data;

    await saveUser(importedUser);
    for (const importedClass of importedClassList) {
      await saveClass(importedClass);
    }

    return { issueList: [] };
  }

  return { importOnboardingDataFromJson };
}
