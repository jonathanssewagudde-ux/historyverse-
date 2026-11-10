import { migrateTestDatabase, truncateAll } from "../support/database";

export default async function setup() {
  migrateTestDatabase();
  await truncateAll();
}
