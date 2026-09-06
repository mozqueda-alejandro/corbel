<script setup lang="ts">
import type {
  FormSubmitEvent,
  TableColumn
} from "@nuxt/ui";
import { useClipboard } from "@vueuse/core";
import { h, resolveComponent } from "vue";
import * as z from "zod";

const UButton = resolveComponent("UButton");
const UCheckbox = resolveComponent("UCheckbox");
const UBadge = resolveComponent("UBadge");
const UDropdownMenu = resolveComponent("UDropdownMenu");

const toast = useToast();
const { copy } = useClipboard();

type Session = {
  id: string
  date: string
  status: "exported" | "drafting" | "completed"
  overview: string
};

const isCreateModalOpen = ref(false);

async function handleSessionCreateSubmit(sessionCreateModalData: SessionCreateModal) {
  toast.add({ title: "Success", description: "The form has been submitted.", color: "success" });
  console.log(sessionCreateModalData);

  isCreateModalOpen.value = false;
}

const data = ref<Session[]>([
  {
    id: "1",
    date: "2026-08-16",
    status: "exported",
    overview: "Placas"
  }
]);


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
    accessorKey: "id",
    header: "#",
    cell: ({ row }) => `#${row.getValue("id")}`
  }, {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => {
      return new Date(row.getValue("date")).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }
  }, {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const color = ({
        exported: "success" as const,
        drafting: "error" as const,
        completed: "neutral" as const
      })[row.getValue("status") as string];

      return h(UBadge, { class: "capitalize", variant: "subtle", color }, () => row.getValue("status"));
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
    meta: {
      class: {
        td: "text-right"
      }
    },
    cell: ({ row }) => {
      const items = [{
        type: "label",
        label: "Actions"
      }, {
        label: "Copy payment ID",
        onSelect() {
          copy(row.original.id);

          toast.add({
            title: "Payment ID copied to clipboard!",
            color: "success",
            icon: "i-lucide-circle-check"
          });
        }
      }, {
        label: row.getIsExpanded() ? "Collapse" : "Expand",
        onSelect() {
          row.toggleExpanded();
        }
      }, {
        type: "separator"
      }, {
        label: "View customer"
      }, {
        label: "View payment details"
      }];

      return h(UDropdownMenu, {
        "content": {
          align: "end"
        },
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
          :data="data"
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
  </div>
</template>
