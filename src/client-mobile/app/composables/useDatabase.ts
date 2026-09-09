import Dexie, { type EntityTable } from "dexie";

import type { Class } from "~/schemas/class.schema";
import type { Session } from "~/schemas/session.schema";
import type { User } from "~/schemas/user.schema";

class CorbelDatabase extends Dexie {
  sessionTable!: EntityTable<Session, "id">;
  classTable!: EntityTable<Class, "id">;
  userTable!: EntityTable<User, "id">;
  noteTable!: EntityTable<Note, "id">;

  constructor() {
    super("attendance-database");
    this.version(3).stores({
      sessionTable: "id, name, date",
      classTable: "id, name, startDate, endDate",
      userTable: "id, firstName, lastName",
      noteTable: "id, name"
    });
  }
}

let databaseInstance: CorbelDatabase | null = null;

export function useDatabase() {
  if (!databaseInstance) {
    databaseInstance = new CorbelDatabase();
  }
  return databaseInstance;
}
