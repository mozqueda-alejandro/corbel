import Dexie, { type EntityTable } from "dexie";

interface Task {
  id: number
  title: string
  done: boolean
}

const db = new Dexie("TaskDatabase") as Dexie & {
  tasks: EntityTable<Task, "id">
};

db.version(1).stores({
  tasks: "++id, title, done"
});

export { db };
export type { Task };
