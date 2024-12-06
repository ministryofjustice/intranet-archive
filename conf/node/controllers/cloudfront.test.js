import {
  getCdnUrl,
  getKeyPairId,
  getCookies,
  getDateLessThan,
} from "./cloudfront.js";

describe("getCdnUrl", () => {
  it("should return a cdn URL object", () => {
    const result = getCdnUrl(new URL("https://app.archive.example.com"));
    expect(result.host).toBe("archive.example.com");
    expect(result.origin).toBe("https://archive.example.com");
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

    const result = getCookies({
      resource,
      dateLessThan,
    });

    expect(result).toBeDefined();
    expect(result["CloudFront-Key-Pair-Id"]).toBeDefined();
    expect(result["CloudFront-Policy"]).toBeDefined();
    expect(result["CloudFront-Signature"]).toBeDefined();
  });
});
