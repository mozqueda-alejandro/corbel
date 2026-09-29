import Dexie, { type EntityTable } from "dexie";

class CorbelDatabase extends Dexie {
  activityTypeTable!: EntityTable<ActivityType, "id">;
  dailySkillTable!: EntityTable<DailySkill, "id">;
  classTable!: EntityTable<Class, "id">;
  noteTable!: EntityTable<Note, "id">;
  sessionTable!: EntityTable<Session, "id">;
  studentTable!: EntityTable<Student, "id">;
  testVariantTable!: EntityTable<TestVariant, "id">;
  userTable!: EntityTable<User, "id">;

  constructor() {
    super("attendance-database");
    this.version(3).stores({
      activityTypeTable: "id",
      classTable: "id, name",
      dailySkillTable: "id",
      noteTable: "id, name",
      sessionTable: "id, name, date",
      studentTable: "id, firstName, lastName",
      testVariantTable: "id",
      userTable: "id, firstName, lastName"
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
