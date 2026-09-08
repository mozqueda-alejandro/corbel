import { type User, userSchema } from "~/schemas/user.schema";

export function useUserRepository() {
  const database = useDatabase();

  const { data: userListRef, error: userListErrorRef } = useLiveQuery(() => database.userTable.toArray());

  const currentUserRef = computed(() => userListRef.value?.[0]);

  async function saveUser(userData: User) {
    const validatedUser = userSchema.parse(userData);
    await database.userTable.put(validatedUser);
  }

  return { userListRef, userListErrorRef, currentUserRef, saveUser };
}
