export function useTestVariantRepository() {
  const database = useDatabase();

  const { data: testVariantListRef, error: testVariantListErrorRef } = useLiveQuery(() => database.testVariantTable.toArray());

  return { testVariantListRef, testVariantListErrorRef };
}
