import fs from "node:fs";

import { deleteOldSnapshots } from "./lifecycle.js";

describe("deleteOldSnapshots", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tenDaysAgo = new Date(Date.now() - 864000000)
    .toISOString()
    .slice(0, 10);

  beforeAll(async () => {
    // Create some files in the snapshots folder
    try {
      fs.mkdirSync("/tmp/test-snapshots");
      fs.mkdirSync("/tmp/test-snapshots/hq");
      fs.mkdirSync(`/tmp/test-snapshots/hq/${today}`);
      fs.mkdirSync(`/tmp/test-snapshots/hq/${yesterday}`);
      fs.mkdirSync(`/tmp/test-snapshots/hq/${tenDaysAgo}`);
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  });

  afterAll(async () => {
    // Clean up the snapshots folder
    fs.rmSync("/tmp/test-snapshots", { recursive: true, force: true });
  });

  it("should delete snapshots older than 7 days", async () => {
    await deleteOldSnapshots('/tmp/test-snapshots');
    const files = fs.readdirSync("/tmp/test-snapshots/hq");
    
    expect(files).toContain(today);
    expect(files).toContain(yesterday);
    expect(files).not.toContain(tenDaysAgo);
  });
});
