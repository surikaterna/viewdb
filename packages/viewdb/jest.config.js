/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/dist', '<rootDir>/test'],
  transform: {
    '^.+\\.js$': ['es-jest']
  },

  testRegex: '(/test/.*|(\\.|/)(test|spec))\\.js$',
  moduleDirectories: ['node_modules', 'dist'],
  moduleFileExtensions: ['js', 'json', 'node']
};
