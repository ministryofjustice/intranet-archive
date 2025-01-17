import { expect, it, jest } from "@jest/globals";

import { parseSchduleString, scheduleFunction } from "./schedule";

jest.useFakeTimers();

describe("parseSchduleString", () => {
  it("should parse the schedule string into an object", () => {
    const scheduleString = "hq:Mon:17:30,hmcts:Tue:17:30";

    const result = parseSchduleString(scheduleString);

    expect(result).toEqual([
      { agency: "hq", dayIndex: 1, hour: 17, min: 30 },
      { agency: "hmcts", dayIndex: 2, hour: 17, min: 30 },
    ]);
  });

  it("should throw an error for an invalid day of the week", () => {
    const scheduleString = "hq:Monday:17:30";

    expect(() => {
      parseSchduleString(scheduleString);
    }).toThrow("Invalid day of the week");
  });

  it("should throw an error for an invalid time format", () => {
    const scheduleString = "hq:Mon:25:00";

    expect(() => {
      parseSchduleString(scheduleString);
    }).toThrow("Invalid time format");
  });

  it("should handle an empty string", () => {
    const scheduleString = "";

    const result = parseSchduleString(scheduleString);

    expect(result).toEqual([]);
  });
});

describe("scheduleFunction", () => {
  it("should execute the callback at the scheduled time", () => {
    const callback = jest.fn();
    const schedule = { dayIndex: 1, hour: 14, min: 30 };

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
    const schedule = { dayIndex: 1, hour: 14, min: 30 };

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
    const schedule = { dayIndex: 1, hour: 14, min: 30 };

    // Mock Date to control the current time
    const mockDate = new Date("2023-10-02T14:29:00"); // A Monday at 14:29
    jest.setSystemTime(mockDate);

    scheduleFunction(schedule, callback);

    // Fast-forward until just before the scheduled time
    jest.advanceTimersByTime(59_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("should throw an error for an invalid day of the week", () => {
    const callback = jest.fn();
    const schedule = { dayIndex: 8, hour: 14, min: 30 };

    expect(() => {
      scheduleFunction(schedule, callback);
    }).toThrow("Invalid day of the week");
  });

  it("should throw an error for an invalid time format", () => {
    const callback = jest.fn();
    const schedule = { dayIndex: 1, hour: 25, min: 0 };

    expect(() => {
      scheduleFunction(schedule, callback);
    }).toThrow("Invalid time format");
  });
});
