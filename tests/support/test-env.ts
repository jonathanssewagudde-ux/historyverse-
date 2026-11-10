import defaults from "./test-env.json";

/**
 * Environment for automated tests. These are throwaway local values for a disposable test
 * database, not credentials for any real system. CI overrides the URL with TEST_DATABASE_URL.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? defaults.DATABASE_URL;

export const testEnv = { ...defaults, DATABASE_URL: TEST_DATABASE_URL };
