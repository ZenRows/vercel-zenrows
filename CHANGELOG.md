# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Changed

- **Breaking:** `creditsSpent` on every tool result is now a `number`, read from the `X-Request-Credits` header. It used to be the raw `X-Request-Cost` header as a `string`, which is the cost in US dollars rather than credits. Code that reads it as a string, for example with `parseFloat` or string concatenation, needs updating.
- Requires `zenrows` 2.3.0 or later, which does not retry Extract's 422 `no_data_extracted`.

### Added

- `costUsd` on every tool result: what the request cost in US dollars, from `X-Request-Cost`.
- `extractData` accepts every documented `outputs` filter, not only six of them.
- `extractData` explains Extract's 422 `no_data_extracted` (not charged, read the page with `scrapeUrl` instead of repeating the call) and 403 `REQS007` (domain not prepared, not charged) instead of reporting them as a failed scrape or a bad API key.

## [0.1.1] - 2026-09-17

- First release: `scrapeUrl`, `extractData` and `takeScreenshot` tools for the Vercel AI SDK.

[0.2.0]: https://github.com/ZenRows/vercel-zenrows/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ZenRows/vercel-zenrows/releases/tag/v0.1.1
