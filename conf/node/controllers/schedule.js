import { intranetUrls } from "../constants.js";

/**
 * Parse a schedule string to determine when each agency should be crawled.
 *
 * @param {string} [scheduleString] - The schedule string in the format "agency:dayOfWeek:hour:min,agency:dayOfWeek:hour:min".
 * @returns {Array<{ env: string, agency: string, depth?: number, dayIndexes: number[], hour: number, min: number }>}
 *
 * @throws {Error} If the schedule string is not in the correct format.
 */

export const parseScheduleString = (scheduleString) => {
  const scheduleArray = scheduleString?.split(",") ?? [];

  return scheduleArray
    .map((schedule) => schedule.trim())
    .filter((schedule) => schedule?.length)
    .map((schedule) => {
      const [env, agency, dayOfWeek, timeString, optionalDepth] =
        schedule.split("::");

      if (!intranetUrls[env]) {
        throw new Error("Invalid environment");
      }

      const dayIndex = [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
      ].indexOf(dayOfWeek);

      if (dayIndex === -1) {
        throw new Error("Invalid day of the week");
      }

      const [hourString, minString] = timeString.split(":");

      // Parse hours and minutes as numbers
      const hour = parseInt(hourString);
      const min = parseInt(minString);

      // Validate the input
      if (
        isNaN(hour) ||
        isNaN(min) ||
        hour < 0 ||
        hour > 23 ||
        min < 0 ||
        min > 59
      ) {
        throw new Error("Invalid time format");
      }

      if (!optionalDepth) {
        return { env, agency, dayIndexes: [dayIndex], hour, min };
      }

      const depth = parseInt(optionalDepth);

      if (isNaN(depth) || depth.toString() !== optionalDepth) {
        throw new Error("Invalid depth");
      }

      return { env, agency, dayIndexes: [dayIndex], hour, min, depth };
    });
};

/**
 * Schedules a function to run at a specific day of the week and time.
 *
 * @param {{ dayIndexes?: number[], hour: number, min: number }} schedule - The schedule object containing day of the week, hour, and minute.
 * @param {function} callback - The function to be executed.
 * @returns {void}
 *
 * @throws {Error} If the day of the week or time is invalid.
 */
export const scheduleFunction = ({ dayIndexes, hour, min }, callback) => {
  // Default to all days of the week
  if(!dayIndexes) {
    dayIndexes = [0, 1, 2, 3, 4, 5, 6];
  }

  // Validate day the input
  if (dayIndexes.some((dayIndex) => dayIndex < 0 || dayIndex > 6)) {
    throw new Error("Invalid day of the week");
  }

  if (
    isNaN(hour) ||
    isNaN(min) ||
    hour < 0 ||
    hour > 23 ||
    min < 0 ||
    min > 59
  ) {
    throw new Error("Invalid time format");
  }

  function checkAndRun() {
    const now = new Date();
    if (
      dayIndexes.includes(now.getDay()) &&
      now.getHours() === hour &&
      now.getMinutes() === min
    ) {
      callback();
    }
  }

  setInterval(checkAndRun, 60000); // Check every minute
};
