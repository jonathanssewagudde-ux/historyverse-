import { beforeAll } from "vitest";

import { truncateAll } from "../support/database";

// Every integration test file starts from an empty, migrated database, so files never depend
// on each other's data or on the order they run in.
beforeAll(async () => {
  await truncateAll();
});
