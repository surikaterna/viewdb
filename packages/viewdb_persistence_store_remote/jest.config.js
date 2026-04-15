/** @type {import('jest').Config} */
module.exports = {
  transformIgnorePatterns: ['node_modules[/\\\\](?!uuid)'],
  transform: {
    '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }]
  }
};
