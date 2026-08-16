<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const open = ref(true);

const items: NavigationMenuItem[][] = [[{
  label: "Dashboard",
  icon: "i-lucide-layout-grid",
  to: "/"
}, {
  label: "Contacts",
  icon: "i-lucide-users",
  to: "/contacts"
}, {
  label: "Sessions",
  icon: "i-lucide-calendar-clock",
  to: "/sessions"
}, {
  label: "Reports",
  icon: "i-lucide-file-chart-column",
  to: "/reports"
}], [{
  label: "Library",
  icon: "i-lucide-library-big",
  to: "/library"
}]];
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="items[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="items[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>
    </UDashboardSidebar>
    <slot />
  </UDashboardGroup>
</template>
