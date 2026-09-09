<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem } from "@nuxt/ui";
import { useColorMode } from "@vueuse/core";

import { useDBTest } from "~/composables/useDBTest.ts";

const open = ref(true);
const route = useRoute();
const colorMode = useColorMode();

const { sessionListRef } = useSessionRepository();
const { classListRef, saveClass } = useClassRepository();
const { currentUserRef } = useUserRepository();
const { clearUserAndClassData } = useDBTest();

const selectedClassRef = ref(pickDefaultClass(classListRef.value ?? []));
watch(classListRef, (newClassList) => {
  if (!selectedClassRef.value) {
    selectedClassRef.value = pickDefaultClass(newClassList ?? []);
  }
}, { immediate: true });

const classesItems = computed<DropdownMenuItem[][]>(() => {
  const classList = classListRef.value ?? [];
  return [classList.map((classItem, index) => ({
    label: classItem.name,
    avatar: { icon: "i-lucide-graduation-cap" },
    kbds: ["meta", String(index + 1)],
    onSelect() {
      selectedClassRef.value = classItem;
    }
  })), [{
    label: "Create class",
    icon: "i-lucide-circle-plus"
  }]];
});

function getItems(): NavigationMenuItem[] {
  return [{
    label: "Sessions",
    icon: "i-lucide-calendar",
    to: "/",
    active: route.path.endsWith("/") || route.path.startsWith("/sessions"),
    badge: String(sessionListRef.value?.length)
  }, {
    label: "Contacts",
    icon: "i-lucide-contact",
    to: "/contacts",
    active: route.path.startsWith("/contacts")
  }, {
    label: "Tests",
    icon: "i-lucide-clipboard-list",
    to: "/tests",
    active: route.path.startsWith("/tests")
  }];
}

function getFooterItems(): NavigationMenuItem[] {
  return [{
    label: "Open notes",
    icon: "i-lucide-notebook-pen",
    onClick() {
      openSlideover.value = true
    }
  }];
}

const userItems = computed<DropdownMenuItem[][]>(() => ([[{
  label: "Profile",
  icon: "i-lucide-user",
  to: "/profile"
}, {
  label: "Settings",
  icon: "i-lucide-settings",
  to: "/settings"
}], [{
  label: "Appearance",
  icon: "i-lucide-sun-moon",
  children: [{
    label: "Light",
    icon: "i-lucide-sun",
    type: "checkbox",
    checked: colorMode.value === "light",
    onUpdateChecked(checked: boolean) {
      if (checked) colorMode.value = "light";
    },
    onSelect(e: Event) { e.preventDefault(); }
  }, {
    label: "Dark",
    icon: "i-lucide-moon",
    type: "checkbox",
    checked: colorMode.value === "dark",
    onUpdateChecked(checked: boolean) {
      if (checked) colorMode.value = "dark";
    },
    onSelect(e: Event) { e.preventDefault(); }
  }]
}]]));

defineShortcuts(extractShortcuts(classesItems.value));
</script>

<template>
  <div class="flex h-dvh w-screen overflow-hidden">
    <USidebar
      v-model:open="open"
      collapsible="offcanvas"
      :ui="{ container: 'h-full', inner: 'bg-elevated/25 divide-transparent', body: 'py-0' }"
    >
      <template #header>
        <UDropdownMenu
          :items="classesItems"
          :content="{ align: 'start', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            :avatar="{ icon: 'i-lucide-graduation-cap' }"
            :label="selectedClassRef?.name ?? 'Select class'"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            square
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
          />
        </UDropdownMenu>
      </template>

      <template #default>
        <UNavigationMenu
          :items="getItems()"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />
      </template>

      <template #footer>
        <div class="flex flex-col gap-2 w-full">
          <UNavigationMenu
            :items="getFooterItems()"
            orientation="vertical"
            classes="mt-auto"
          />
          <USeparator></USeparator>
          <UDropdownMenu
            :items="userItems"
            :content="{ align: 'start', collisionPadding: 12 }"
            :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
          >
            <UButton
              :avatar="{ icon: 'i-lucide-user-round' }"
              :label="currentUserRef ? `${currentUserRef.firstName} ${currentUserRef.lastName}` : 'User'"
              trailing-icon="i-lucide-chevrons-up-down"
              color="neutral"
              variant="ghost"
              square
              class="w-full data-[state=open]:bg-elevated overflow-hidden"
              :ui="{ trailingIcon: 'text-dimmed ms-auto' }"
            />
          </UDropdownMenu>
        </div>
      </template>
    </USidebar>

    <div class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      <div class="h-(--ui-header-height) shrink-0 flex items-center justify-between px-4 border-b border-default">
        <UButton
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          aria-label="Toggle sidebar"
          @click="open = !open"
        />
        <div class="flex items-center gap-6">
          <UButton
            label="Test Clear"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            @click="clearUserAndClassData"
          />
          <AppLogo class="h-4 mr-2 w-auto" />
        </div>
      </div>

      <div class="flex-1 min-h-0 relative">
        <slot />
      </div>
    </div>
  </div>
</template>
