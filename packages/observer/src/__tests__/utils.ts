export function spyObject<T extends Record<string | symbol, any>>(obj: T) {
  // create a new object with all the methods replaced with spies
  const spyObj: Record<string | symbol, jest.Mock> = {};

  [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertySymbols(obj)].forEach(key => {
    const value = obj[key];
    if (typeof value === 'function') {
      spyObj[key] = jest.fn(value);
    }
  });

  function reset() {
    Object.values(spyObj).forEach(spy => spy.mockClear());
  }

  return { spy: spyObj as T, reset };
}
