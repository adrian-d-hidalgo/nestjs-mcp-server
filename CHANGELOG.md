# [0.4.0-rc.1](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/compare/v0.3.0...v0.4.0-rc.1) (2025-12-31)


### Bug Fixes

* add packageManager field for pnpm version specification ([#90](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/90)) ([8878104](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/8878104c0dc30dbf3ee8904c48e99b23dedd07c6)), closes [#89](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/89)
* **husky:** update pre-commit hook and add quality scripts ([#76](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/76)) ([d245124](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/d2451247d68307acbf1142bc00f51615f1dcf124)), closes [#75](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/75)
* resolve guards from DI container using ModuleRef ([#82](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/82)) ([476b547](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/476b547e026b4108d96c8ee29b40513b78d7b637)), closes [#70](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/70)


### Features

* **release:** migrate to semantic-release and standardize Node.js v24 ([c81b017](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/c81b017fcb2f00e06dfedb9e2200732f0592ec4a)), closes [#87](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/87)
* **release:** migrate to semantic-release and standardize Node.js v24 ([#88](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/88)) ([d4e48b8](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/d4e48b88b77ecc077b5662c0e1fd9d77164b47d4)), closes [#87](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/87)

# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/compare/v0.2.0...v0.3.0) (2025-05-18)


### Features

* add tool annotations support ([#56](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/56)) ([f2fd45f](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/f2fd45f600494d521df1cc5e68f8f7c1b2a42b74))


### Bug Fixes

* change type annotation from unknown to any for args in useFactory ([#65](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/65)) ([c47bd77](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/c47bd775ee345b2bf76bb82b8ba8ddaa3d9ec879))
* enhance npm publish script to handle prerelease suffixes and improve version management ([#64](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/64)) ([04f15c3](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/04f15c3dc3dce7e4b6155b272926e897e9edf05e))
* enhance version validation in npm publish script ([#62](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/62)) ([2eee593](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/2eee59363d2204d8c1fa8ada12fd4bd3ccf226fc))
* improve Tools examples to clarify arguments for each variation ([#67](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/67)) ([5a511eb](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/5a511eb63435de827932f3d23a3091bd4d6f9db1))
* suppress Husky deprecation warning ([#63](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/63)) ([a1cb0ef](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/a1cb0efc66d9a104bb798efe4fe72f3173803492))
* update tool decorator interfaces for improved clarity and consistency ([#66](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/66)) ([3b082f6](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/3b082f63bbe22228d75880c13e010410acdf6366))

## [0.2.0](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/compare/v0.1.1...v0.2.0) (2025-05-09)


### Features

* add headers to extra param ([770d331](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/770d331e554a2ef9193533f1d4d69e3b3f2f4d72))


### Bug Fixes

* correct tag validation and npm publish workflow ([3a1d18e](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/3a1d18e77f92552ebc3e2f52cf3023fdc7c09eb0))
* enhance branch detection and version validation in npm publish script ([#41](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/41)) ([cc0e10c](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/cc0e10c4299d17ad7705128a613d6ced2fee3343))

## [0.1.1](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/releases/tag/v0.1.1) (2025-05-02)


### Features

* Initial implementation of NestJS MCP Server module ([a810121](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/a8101210caa1d0549222a0574228033420d5101f))


### Bug Fixes

* add missing server initialization ([#10](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/10)) ([6f059cc](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/6f059ccdb14dffe24156c044897eb3a0500be33c))
* Correct the instructions for package installation ([#19](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/19)) ([385f0df](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/385f0df137c040ff196b30cbd88fd215889022c2))
* export MessageService from McpModule for fix accessibility ([#9](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/9)) ([e07a913](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/e07a9133a303b1e86b3c1f1b1d640fbf7db08d67))
* fix ResourceTemplateParams atributes ([#14](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/14)) ([4587ee4](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/4587ee49e39bfe85d9b7381bdc080c8fe8b0e93e))
* implement SessionManager to provide HTTP request context ([#13](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/13)) ([938cec6](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/938cec638c0a86f934f19a920dc69ff7ce6da907))
* improve build generation and exclude non-essential files from deployment ([#5](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/5)) ([28fda58](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/28fda58c927d83fbf75ff864d3a436d826fe7607))
* **streamable:** refactor Guard Context construction for Streamable mode compatibility ([#11](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/issues/11)) ([2c74371](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/2c7437199a854b55e5fbbc397c4b4bdf6ae595a8))
* update import paths to include .js extension for compatibility ([cdd15cb](https://github.com/adrian-d-hidalgo/nestjs-mcp-server/commit/cdd15cb1e745ba0c3481392b87e42c7942eabe44))
