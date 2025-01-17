/**
 * Parse a schedule string to determine when each agency should be crawled.
 *
 * @param {string} [scheduleString] - The schedule string in the format "agency:dayOfWeek:hour:min,agency:dayOfWeek:hour:min".
 * @returns {Array<{ agency: string, dayIndex: number, hour: number, min: number }>}
 *
 * @throws {Error} If the schedule string is not in the correct format.
 */

export const parseSchduleString = (scheduleString) => {
  const scheduleArray = scheduleString?.split(",") ?? [];

  return scheduleArray
    .filter((schedule) => schedule?.length)
    .map((schedule) => {
      const [agency, dayOfWeek, hourString, minString] = schedule.split(":");

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

      return { agency, dayIndex, hour, min };
    });
};

/**
 * Schedules a function to run at a specific day of the week and time.
 *
 * @param {{ dayIndex: number, hour: number, min: number }} schedule - The schedule object containing day of the week, hour, and minute.
 * @param {function} callback - The function to be executed.
 * @returns {void}
 *
 * @throws {Error} If the day of the week or time is invalid.
 */
export const scheduleFunction = ({ dayIndex, hour, min }, callback) => {
  if (dayIndex < 0 || dayIndex > 6) {
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
      now.getDay() === dayIndex &&
      now.getHours() === hour &&
      now.getMinutes() === min
    ) {
      callback();
    }
  }

  setInterval(checkAndRun, 60000); // Check every minute
};
