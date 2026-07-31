/**
 * semantic-release configuration
 * @see https://semantic-release.gitbook.io/semantic-release/usage/configuration
 */
module.exports = {
  branches: [
    // Stable channel: released manually via the Release workflow -> npm `latest`.
    'main',
    // Pre-release channel: every push publishes X.Y.Z-next.N -> npm `next`.
    // The channel name is derived from the branch name, so one branch == one dist-tag.
    { name: 'next', prerelease: true },
  ],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          { type: 'build', scope: 'deps', release: 'patch' },
          { type: 'chore', scope: 'deps', release: 'patch' },
        ],
      },
    ],
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
