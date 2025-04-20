export const DEFAULT_DEBOUNCE_DURATION = 500;

export function debounce(method: string, duration = DEFAULT_DEBOUNCE_DURATION) {
  let timeoutId: any;

  function debounceWrapper(...args: any) {
    debounceWrapper.clear();

    timeoutId = setTimeout(() => {
      timeoutId = null;
      // @ts-ignore
      method.apply(this, args);
    }, duration);
  }

  debounceWrapper.clear = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounceWrapper;
}
