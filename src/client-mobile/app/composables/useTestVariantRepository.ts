import { type TestVariant, testVariantSchema } from "~/schemas/test-variant.schema";

export function useTestVariantRepository() {
  const database = useDatabase();
  const { syncTestVariantList } = useSessionRepository();

  const { data: testVariantListRef, error: testVariantListErrorRef } = useLiveQuery(() => database.testVariantTable.toArray());

  // Saves the tests and passes the changes on to sessions that can still change, in one transaction.
  // Names must stay unique, checked against the stored tests so two quick saves can't both pass.
  async function saveTestVariantList(testVariantList: TestVariant[]) {
    const validatedList = testVariantList.map(testVariant => testVariantSchema.parse(testVariant));

    await database.transaction("rw", [database.testVariantTable, database.sessionTable, database.photoTable, database.userTable], async () => {
      const finalById = new Map((await database.testVariantTable.toArray()).map(testVariant => [testVariant.id, testVariant]));
      for (const testVariant of validatedList) finalById.set(testVariant.id, testVariant);

      const finalList = [...finalById.values()];
      for (const testVariant of validatedList) {
        const lowerName = testVariant.name.toLowerCase();
        if (finalList.filter(otherTest => otherTest.name.toLowerCase() === lowerName).length > 1) {
          throw new Error(`A test named "${testVariant.name}" already exists.`);
        }
      }

      await database.testVariantTable.bulkPut(validatedList);
      await syncTestVariantList(validatedList);
    });
  }

  async function saveTestVariant(testVariant: TestVariant) {
    await saveTestVariantList([testVariant]);
  }

  // Sessions keep their own copy of any test they have scores for, so deleting never changes their results.
  async function deleteTestVariantList(testVariantIdList: string[]) {
    await database.testVariantTable.bulkDelete(testVariantIdList);
  }

  return { testVariantListRef, testVariantListErrorRef, saveTestVariant, saveTestVariantList, deleteTestVariantList };
}
