/**
 * @typedef {Object} RetryOptions
 * @property {Function} [delay] - the delay between retries
 * @property {Function} [retry] - the retry condition
 * @property {Function} [error] - the error handler
 */

/**
 * Default retry options.
 * @type {RetryOptions}
 */
const defaultOptions = {
  // use delays with 5s increments
  delay: (s) => (s.index + 1) * 5000,
  // retry for up to 10 times
  retry: (s) => s.index < 10,
  // error handler
  error: (s) => {
    const info = {
      index: s.index,
      duration: s.duration,
      error: s.error.message,
    };
    console.error("Handling:", info);
  },
};

/**
 * Retries async operation returned from "func" callback, according to "options".
 *
 * This function is vendored from the original source code at:
 * https://github.com/vitaly-t/retry-async/blob/main/src/retry-async.js
 *
 * @param {Function} func - The async function to retry
 * @param {RetryOptions} [options] - The retry options
 */
function retryAsync(func, options = {}) {
  const start = Date.now();
  let index = 0,
    e;
  let {
    retry = Number.POSITIVE_INFINITY,
    delay = -1,
    error,
  } = { ...defaultOptions, ...options };
  const s = () => ({ index, duration: Date.now() - start, error: e });
  const c = () =>
    func(s()).catch((err) => {
      e = err;
      typeof error === "function" && error(s());
      if ((typeof retry === "function" ? (retry(s()) ? 1 : 0) : retry--) <= 0) {
        return Promise.reject(e);
      }
      const d = typeof delay === "function" ? delay(s()) : delay;
      index++;
      return d >= 0 ? new Promise((a) => setTimeout(a, d)).then(c) : c();
    });
  return c();
}

export { retryAsync };
