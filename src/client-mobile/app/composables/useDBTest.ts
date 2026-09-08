export function useDBTest() {
  async function clearUserAndClassData() {
    const database = useDatabase();
    await database.userTable.clear();
    await database.classTable.clear();
    window.location.reload();
  }

  return { clearUserAndClassData };
}
