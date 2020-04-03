declare namespace jasmine {
  interface Matchers<T> {
    toEqualLocation(expected: any, expectationFailOutput?: any): boolean;
  }
}
