import { logger, Objects } from '../../main';

describe('Object.requireNonEmpty Unit Test', () => {
  const check = (input1: any, input2: any, input3: any): boolean => {
    try {
      Objects.requireNonEmpty([input1, input2, input3], new Error('Invalid input'));
      return false;
    } catch (e: any) {
      logger.error('An error occurred in Objects unit test: ', e);
      return true;
    }
  };
  test.each([
    ['10001', '1d531cba-7220-4dee-9187-6e8168f4ff6c', 1, false],
    ['', 'hi', 'hello', true],
    [10, 1, 5, false]
  ])('should throw exception because one of [%s, %s, and %s] is empty => %s', (input1, input2, input3, result) => {
    expect(check(input1, input2, input3)).toBe(result);
  });
});
