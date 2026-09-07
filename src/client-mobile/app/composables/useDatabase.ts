import Dexie, { type EntityTable } from "dexie";

import type { Session } from "~/schemas/session.schema";

class AttendanceDatabase extends Dexie {
  sessionTable!: EntityTable<Session, "id">;

  constructor() {
    super("attendance-database");
    this.version(1).stores({
      sessionTable: "id, name, date"
    });
  }
}

let databaseInstance: AttendanceDatabase | null = null;

export function useDatabase() {
  if (!databaseInstance) {
    databaseInstance = new AttendanceDatabase();
  }
  return databaseInstance;
}
