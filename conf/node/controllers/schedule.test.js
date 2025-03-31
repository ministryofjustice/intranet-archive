import { expect, it, jest } from "@jest/globals";

import { parseScheduleString, scheduleFunction } from "./schedule.js";

jest.useFakeTimers();

describe("system timezone", () => {
  it("should be be Europe/London", () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(timezone).toBe("Europe/London");
  });
});

describe("parseScheduleString", () => {
  it("should parse the schedule string into an object", () => {
    const scheduleString =
      "dev::hq::Mon::17:30::1,production::hmcts::Tue::17:30";

    const result = parseScheduleString(scheduleString);

    expect(result).toEqual([
      {
        env: "dev",
        agency: "hq",
        dayIndexes: [1],
        hour: 17,
        min: 30,
        depth: 1,
      },
      {
        env: "production",
        agency: "hmcts",
        dayIndexes: [2],
        hour: 17,
        min: 30,
      },
    ]);
  });

  it("should handle spaces in the schedule string", () => {
    const scheduleString =
      "dev::hq::Mon::17:30::1, production::hmcts::Tue::17:30";

    const result = parseScheduleString(scheduleString);

    expect(result).toEqual([
      {
        env: "dev",
        agency: "hq",
        dayIndexes: [1],
        hour: 17,
        min: 30,
        depth: 1,
      },
      {
        env: "production",
        agency: "hmcts",
        dayIndexes: [2],
        hour: 17,
        min: 30,
      },
    ]);
  });

  it("should throw an error for an invalid environment", () => {
    const scheduleString = "preprod::hq::Mon::17:30";

    expect(() => {
      parseScheduleString(scheduleString);
    }).toThrow("Invalid environment");
  });

  it("should throw an error for an invalid day of the week", () => {
    const scheduleString = "dev::hq::Monday::17:30";

    expect(() => {
      parseScheduleString(scheduleString);
    }).toThrow("Invalid day of the week");
  });

  it("should throw an error for an invalid time format", () => {
    const scheduleString = "staging::hq::Mon::25:00";

    expect(() => {
      parseScheduleString(scheduleString);
    }).toThrow("Invalid time format");
  });

  it("should throw an error for an invalid depth", () => {
    const scheduleString = "dev::hq::Mon::17:30::abc";

    expect(() => {
      parseScheduleString(scheduleString);
    }).toThrow("Invalid depth");
  });

  it("should handle an empty string", () => {
    const scheduleString = "";

    const result = parseScheduleString(scheduleString);

    expect(result).toEqual([]);
  });
});

describe("scheduleFunction", () => {
  it("should execute the callback at the scheduled time", () => {
    const callback = jest.fn();
    const schedule = { dayIndexes: [1], hour: 14, min: 30 };

    // Mock Date to control the current time
    const mockDate = new Date("2023-10-02T14:29:30"); // A Monday at 14:29:30
    jest.setSystemTime(mockDate);

    scheduleFunction(schedule, callback);

    // Fast-forward until all timers have been executed
    jest.advanceTimersByTime(60_000);

    expect(callback).toHaveBeenCalled();
  });

  it("should execute multiple times over the course of 3 weeks", () => {
    const callback = jest.fn();
    const schedule = { dayIndexes: [1], hour: 14, min: 30 };

    // Mock Date to control the current time
    const mockDate = new Date("2023-10-02T14:29:30"); // A Monday at 14:29:30
    jest.setSystemTime(mockDate);

    scheduleFunction(schedule, callback);

    // Fast-forward 3 weeks
    jest.advanceTimersByTime(3 * 7 * 24 * 60 * 60 * 1000);

    // The callback should have been called 3 times
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("should not execute the callback before the scheduled time", () => {
    const callback = jest.fn();
    const schedule = { dayIndexes: [1], hour: 14, min: 30 };

    // Mock Date to control the current time
    const mockDate = new Date("2023-10-02T14:29:00"); // A Monday at 14:29
    jest.setSystemTime(mockDate);

    scheduleFunction(schedule, callback);

    // Fast-forward until just before the scheduled time
    jest.advanceTimersByTime(59_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("should default to all days of the week", () => {
    const callback = jest.fn();
    const schedule = { hour: 14, min: 30 };

    // Mock Date to control the current time
    const mockDate = new Date("2023-10-02T14:29:30"); // A Monday at 14:29:30
    jest.setSystemTime(mockDate);

    scheduleFunction(schedule, callback);

    // Fast-forward 8 days
    jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

    // The callback should have been called 8 times
    expect(callback).toHaveBeenCalledTimes(8);
  });

  it("should throw an error for an invalid day of the week", () => {
    const callback = jest.fn();
    const schedule = { dayIndexes: [8], hour: 14, min: 30 };

    expect(() => {
      scheduleFunction(schedule, callback);
    }).toThrow("Invalid day of the week");
  });

  it("should throw an error for an invalid time format", () => {
    const callback = jest.fn();
    const schedule = { dayIndexes: [1], hour: 25, min: 0 };

    expect(() => {
      scheduleFunction(schedule, callback);
    }).toThrow("Invalid time format");
  });
});
