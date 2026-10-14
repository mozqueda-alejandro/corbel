export function useAppReadiness() {
  const { userListRef } = useUserRepository();
  const { classListRef } = useClassRepository();

  const isLoading = computed(() =>
    userListRef.value === undefined || classListRef.value === undefined);

  const isReady = computed(() =>
    (userListRef.value?.length ?? 0) > 0 && (classListRef.value?.length ?? 0) > 0);

  // Set while the onboarding form is importing. The import makes the data "ready" the moment it commits,
  // which would swap the whole shell in before the form has navigated, so the app stays hidden until then.
  const isOnboardingImportActiveRef = useState("onboarding-import-active", () => false);
  const isAppVisible = computed(() => isReady.value && !isOnboardingImportActiveRef.value);

  return { isLoading, isReady, isAppVisible, isOnboardingImportActiveRef };
}
