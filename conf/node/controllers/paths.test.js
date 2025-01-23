import { it } from "@jest/globals";

import { getAgencyPath, getSnapshotPaths } from "./paths.js";

describe("getAgencyPath", () => {
  it("should return the folder name - production", () => {
    const env = "production";
    const agency = "hq";

    const folder = getAgencyPath(env, agency);

    expect(folder).toBe("hq");
  });

  it("should return the folder name - non-production", () => {
    const env = "dev";
    const agency = "hq";

    const folder = getAgencyPath(env, agency);

    expect(folder).toBe("dev-hq");
  });

  it("should throw an error - invalid env", () => {
    const env = "invalid";
    const agency = "hq";

    expect(() => getAgencyPath(env, agency)).toThrowError(
      `Invalid environment: ${env}`,
    );
  });

  it("should throw an error - invalid agency", () => {
    const env = "production";
    const agency = "invalid";

    expect(() => getAgencyPath(env, agency)).toThrowError(
      `Invalid agency: ${agency}`,
    );
  });
});

describe("getSnapshotPaths", () => {
  it("should return the s3 and fs paths - production", () => {
    const env = "production";
    const agency = "hq";

    const paths = getSnapshotPaths({ env, agency });

    expect(paths).toStrictEqual({
      s3: `${agency}/${new Date().toISOString().slice(0, 10)}`,
      fs: `/tmp/snapshots/${agency}/${new Date().toISOString().slice(0, 10)}`,
    });
  });

  it("should return the s3 and fs paths - non-production", () => {
    const env = "dev";
    const agency = "hq";

    const paths = getSnapshotPaths({ env, agency });

    expect(paths).toStrictEqual({
      s3: `dev-${agency}/${new Date().toISOString().slice(0, 10)}`,
      fs: `/tmp/snapshots/dev-${agency}/${new Date()
        .toISOString()
        .slice(0, 10)}`,
    });
  });

  it("should return the s3 and fs paths - invalid env", () => {
    const env = "invalid";
    const agency = "hq";

    expect(() => getSnapshotPaths({ env, agency })).toThrowError(
      `Invalid environment: ${env}`,
    );
  });
});
