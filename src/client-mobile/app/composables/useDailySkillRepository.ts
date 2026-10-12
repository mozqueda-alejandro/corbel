export function useDailySkillRepository() {
  const database = useDatabase();

  const { data: dailySkillListRef, error: dailySkillListErrorRef } = useLiveQuery(() => database.dailySkillTable.toArray());

  return { dailySkillListRef, dailySkillListErrorRef };
}
