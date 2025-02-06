import {
  getCdnUrl,
  getKeyPairId,
  getCookies,
  getDateLessThan,
  getCookiesToClear,
} from "./cloudfront.js";

describe("getCdnUrl", () => {
  it("should return a cdn URL object", () => {
    const result = getCdnUrl(new URL("https://app.archive.example.com"));
    expect(result.host).toBe("archive.example.com");
    expect(result.origin).toBe("https://archive.example.com");
  });

  it("should return a localhost URL object", () => {
    const result = getCdnUrl(new URL("http://localhost:2000"));
    expect(result).toStrictEqual(new URL("http://localhost:2029"));
  });

  it("should throw an error for invalid host", () => {
    expect(() => getCdnUrl(new URL("https://archive.example.com"))).toThrow(
      "Invalid host",
    );
  });
});

describe("getKeyPairId", () => {
  it("should return an id", () => {
    const id = getKeyPairId();
    expect(id).toBe("GENERATED_BY_AWS");
  });
});

describe("getDateLessThan", () => {
  it("should return a date in the future", () => {
    const date = getDateLessThan();
    expect(date).toBeGreaterThan(Date.now() / 1000);
  });
});

describe("getCookies", () => {
  it("should return cookies for CloudFront", () => {
    const dateLessThan = getDateLessThan();
    const resource = "https://archive.example.com/*";
    const clientIp = "127.0.0.1";

    const result = getCookies({
      resource,
      dateLessThan,
      clientIp,
    });

    expect(result).toBeDefined();
    expect(result["CloudFront-Key-Pair-Id"]).toBeDefined();
    expect(result["CloudFront-Policy"]).toBeDefined();
    expect(result["CloudFront-Signature"]).toBeDefined();

    // Trim trailing underscores from result["CloudFront-Policy"]
    const policyBase64 = result["CloudFront-Policy"].replace(/_*$/g, "");

    const policy = JSON.parse(Buffer.from(policyBase64, "base64").toString());

    const statement = policy.Statement[0];

    expect(statement.Resource).toBe(resource);
    expect(statement.Condition.DateLessThan["AWS:EpochTime"]).toBe(
      dateLessThan,
    );
    expect(statement.Condition.IpAddress["AWS:SourceIp"]).toBe(
      `${clientIp}/32`,
    );
  });
});

describe("getCookiesToClear", () => {
  it("should return cookies", () => {
    const cookies = getCookiesToClear("archive.dev.intranet.docker");

    expect(cookies).toStrictEqual([
      { domain: "dev.intranet.docker", name: "CloudFront-Key-Pair-Id" },
      { domain: "dev.intranet.docker", name: "CloudFront-Policy" },
      { domain: "dev.intranet.docker", name: "CloudFront-Signature" },
      { domain: "intranet.docker", name: "CloudFront-Key-Pair-Id" },
      { domain: "intranet.docker", name: "CloudFront-Policy" },
      { domain: "intranet.docker", name: "CloudFront-Signature" },
    ]);
  });
});
