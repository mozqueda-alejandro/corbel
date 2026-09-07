<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { useClipboard } from "@vueuse/core";
import { h, resolveComponent } from "vue";

const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UBadge = resolveComponent("UBadge");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const toast = useToast();
const { copy } = useClipboard();
const { sessionListRef, saveSession, deleteSession } = useSessionRepository();

type Session = {
  id: string
  date: string
  status: "exported" | "drafting" | "completed"
  overview: string
};

const isDeleteSessionModalOpen = ref(false);

//#region SessionCreateModal
const isCreateModalOpen = ref(false);

function navigateToSession(session: Session) {
  navigateTo(`/sessions/${session.id}`);
}

async function handleSessionCreateSubmit(sessionCreateModalData: Session) {
  await saveSession(sessionCreateModalData);

  isCreateModalOpen.value = false;
  navigateToSession(sessionCreateModalData);
}
//#endregion

//#region Table UI
const statusColorMap: Record<SessionStatusEnum, "success" | "error" | "neutral"> = {
  [SessionStatusEnum.Exported]: "success",
  [SessionStatusEnum.Drafting]: "error",
  [SessionStatusEnum.Completed]: "neutral"
};

const columns: TableColumn<Session>[] = [
  {
    id: "select",
    header: ({ table }) => h(UCheckbox, {
      "modelValue": table.getIsSomePageRowsSelected() ? "indeterminate" : table.getIsAllPageRowsSelected(),
      "onUpdate:modelValue": (value: boolean | "indeterminate") => table.toggleAllPageRowsSelected(!!value),
      "aria-label": "Select all"
    }),
    cell: ({ row }) => h(UCheckbox, {
      "modelValue": row.getIsSelected(),
      "onUpdate:modelValue": (value: boolean | "indeterminate") => row.toggleSelected(!!value),
      "aria-label": "Select row"
    }),
    enableSorting: false,
    enableHiding: false
  }, {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.getValue("name")
  }, {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => {
      const date = new Date(row.getValue("date"));
      const yy = String(date.getFullYear()).slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");

      return `${mm}-${dd}-${yy}`;
    }
  }, {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const statusValue = row.getValue("status") as SessionStatusEnum;
      const color = statusColorMap[statusValue] || "neutral";

      return h(UBadge, {
        class: "capitalize",
        variant: "subtle",
        color
      }, () => statusValue);
    }
  }, {
    accessorKey: "overview",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();

      return h(UButton, {
        color: "neutral",
        variant: "ghost",
        label: "Overview",
        icon: isSorted ? (isSorted === "asc" ? "i-lucide-arrow-up-narrow-wide" : "i-lucide-arrow-down-wide-narrow") : "i-lucide-arrow-up-down",
        class: "-mx-2.5",
        onClick: () => column.toggleSorting(column.getIsSorted() === "asc")
      });
    }
  }, {
    id: "actions",
    enableHiding: false,
    meta: { class: { td: "text-right" } },
    cell: ({ row }) => {
      const items = [{
        type: "label",
        label: "Actions"
      }, {
        label: "Edit",
        onSelect() {
          navigateToSession(row.original);
        }
      }, {
        label: "Delete",
        onSelect() {
          deleteSession(row.original.id);
        }
      }, { type: "separator" }, { label: "Action #1" }, { label: "Action #2" }];

      return h(UDropdownMenu, {
        "content": { align: "end" },
        items,
        "aria-label": "Actions dropdown"
      }, () => h(UButton, {
        "icon": "i-lucide-ellipsis-vertical",
        "color": "neutral",
        "variant": "ghost",
        "aria-label": "Actions dropdown"
      }));
    }
  }
];

const table = useTemplateRef("table");
//#endregion
</script>

<template>
  <div class="flex flex-col w-3/4 max-w-(--ui-container) mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12 gap-6">
    <h2>Sessions</h2>

    <div class="border border-muted rounded-md overflow-hidden">
      <div class="flex-1 divide-y divide-accented w-full">
        <div class="flex items-center gap-2 px-4 py-3.5 overflow-x-auto">
          <UButton
            color="neutral"
            label="New Session"
            icon="i-lucide-plus"
            @click="isCreateModalOpen = true"
          />
        </div>

        <UTable
          ref="table"
          :data="sessionListRef"
          :columns="columns"
          sticky
          class="h-96"
        >
          <template #expanded="{ row }">
            <pre>{{ row.original }}</pre>
          </template>
        </UTable>

        <div class="px-4 py-3.5 text-sm text-muted">
          {{ table?.tableApi?.getFilteredSelectedRowModel().rows.length || 0 }} of
          {{ table?.tableApi?.getFilteredRowModel().rows.length || 0 }} row(s) selected.
        </div>
      </div>
    </div>

    <SessionCreateModal
      v-model:open="isCreateModalOpen"
      @submit="handleSessionCreateSubmit"
    />
    <UModal title="Delete session">
      <UButton
        label="Open"
        color="neutral"
        variant="subtle"
      />

      <template #body>
        Are you sure you want to delete session "session.name"?
      </template>

      <template #footer="{ close }">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          @click="close"
        >
          Cancel
        </UButton>
        <UButton @click="sessionFormRef?.submit()">
          Delete
        </UButton>
      </template>
    </UModal>
  </div>
</template>
