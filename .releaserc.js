/**
 * semantic-release configuration
 * @see https://semantic-release.gitbook.io/semantic-release/usage/configuration
 */
module.exports = {
  branches: [
    'main',
    { name: 'alpha', prerelease: true },
    { name: 'beta', prerelease: true },
    { name: 'rc', prerelease: true },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    '@semantic-release/npm',
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
    '@semantic-release/github',
  ],
};
