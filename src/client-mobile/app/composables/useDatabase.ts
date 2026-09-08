import Dexie, { type EntityTable } from "dexie";

import type { Class } from "~/schemas/class.schema";
import type { Session } from "~/schemas/session.schema";
import type { User } from "~/schemas/user.schema";

class AttendanceDatabase extends Dexie {
  sessionTable!: EntityTable<Session, "id">;
  classTable!: EntityTable<Class, "id">;
  userTable!: EntityTable<User, "id">;

  constructor() {
    super("attendance-database");
    this.version(1).stores({
      sessionTable: "id, name, date",
      classTable: "id, name, startDate, endDate",
      userTable: "id, firstName, lastName"
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
