/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testPathIgnorePatterns: ['/node_modules/'],
  coverageDirectory: './test-reports',
  coveragePathIgnorePatterns: ['node_modules', 'dist', 'src/main/types', 'docker'],
  collectCoverage: true,
  collectCoverageFrom: ['src/main/**/*.ts']
};
