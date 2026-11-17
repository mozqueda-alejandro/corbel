export type TestSubcategory = {
  id: string
  name: string
  // The group the subcategory is listed under.
  category: string
  // The built-in test whose skills are scored for this subcategory.
  testVariantId: string
};

// The Written Test has no subcategories, so it isn't listed here.
export const builtInTestSubcategoryList: TestSubcategory[] = [
  { id: "016602e3-991d-49b0-9396-6b333152e4ce", name: "Block Layouts Bonding and coursing", category: "Lay out Patterns (Brick and Block)", testVariantId: "4134dc4b-9586-4281-b351-3aec1b8f8666" },
  { id: "170ad8ef-89a2-4923-a270-538d0fb555d4", name: "Bonding & Elevations", category: "Lay out Patterns (Brick and Block)", testVariantId: "4134dc4b-9586-4281-b351-3aec1b8f8666" },
  { id: "8796def7-26f9-462f-95cd-dbf7bff953e5", name: "Coursing and Erecting Leads (8\")", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "c6092f7c-8737-4c19-a066-dd78c9a9030d", name: "Jambs & Headers (Masonry Lintels)", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "bbd5db4f-56e3-4442-a298-6ca00fd4ee3f", name: "Speed Block Laying (Straight wall)", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "575c5705-7c34-467b-8a68-6ba169441a4b", name: "Plates", category: "Plates", testVariantId: "c59a5625-6dd4-4871-8094-ab8a54779a28" },
  { id: "18ad994b-5213-44a3-bd86-b979c142c451", name: "Erecting Leads (12\")", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "e83cd479-ab5e-4bab-9189-18cf03dd03e2", name: "Jambs & Headers (Lintels using Halves)", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "b6740355-ff4b-4346-ae7f-76b8610119e1", name: "Veneer Systems", category: "Veneer System", testVariantId: "116d86a1-f026-4fa2-8ef0-22d3237b40f3" },
  { id: "c212eae9-f3ba-4a62-93cb-cca895fe6053", name: "Erecting Leads (4')", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "4414174d-664a-4ae5-9a55-e90980afc686", name: "Erecting Leads(6\")", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "882f9736-1908-4200-9f1c-a8b1e76cef8c", name: "Pilasters", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "bd86d0ae-8f98-4b9b-aa50-be73a718f6dc", name: "Rakes", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "3554263a-94ae-4d09-853a-f1893935c46e", name: "Radius Walls", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "4d0c2119-2d7d-42a1-b4f2-81d410d309c5", name: "Brick Arches", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "9db8c7c9-2b0c-48ef-b185-cc64be5561d6", name: "Brick Laying Intermediate Corners soldier", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "7c93ab6d-1053-4c53-9fbe-34d354219589", name: "Brick Basics Straight wall", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "b8bd1903-a7e2-4675-b41c-0f4de29ecdf2", name: "Block Laying basics", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "1b1f338a-c5ce-4d9e-ad69-be74e94abfd7", name: "Brick Laying Basics", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" },
  { id: "5ea51e82-6311-44dc-8e56-66feb41edf4a", name: "Erecting Leads Brick", category: "Lay up (Brick and block)", testVariantId: "cbb5424a-3765-405c-ac11-580af58a60ea" }
];
