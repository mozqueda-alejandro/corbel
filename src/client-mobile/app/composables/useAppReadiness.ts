export function useAppReadiness() {
  const { userListRef } = useUserRepository();
  const { classListRef } = useClassRepository();

  const isLoading = computed(() =>
    userListRef.value === undefined || classListRef.value === undefined);

  const isReady = computed(() =>
    (userListRef.value?.length ?? 0) > 0 && (classListRef.value?.length ?? 0) > 0);

  return { isLoading, isReady };
}
