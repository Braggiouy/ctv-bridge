# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.15.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.14.1...v1.15.0) (2026-11-25)


### Features

* **app:** remember the window's size and position ([de93b5b](https://github.com/Braggiouy/ctv-bridge/commit/de93b5b4969249eb9e171988254da73eda5070b8))
* **app:** show the version in the header, with an About dialog ([6ad809f](https://github.com/Braggiouy/ctv-bridge/commit/6ad809fe0be98b27cdc0753f99da5fd3dc0bf3aa))
* **console:** copy and save the console's lines ([d57d255](https://github.com/Braggiouy/ctv-bridge/commit/d57d255e10956c2600466b7264a63f3ec5c8e077))
* **project:** cancel a running build or deploy, with elapsed time ([a22fdb1](https://github.com/Braggiouy/ctv-bridge/commit/a22fdb1cc6bd4d2db19a00a246407e4c174ddd86))
* **project:** live reload the app on the TV without reinstalling ([5ea14cd](https://github.com/Braggiouy/ctv-bridge/commit/5ea14cd2253d99115853a16daeb5c32294c74738))
* **project:** restart, stop and uninstall the app without rebuilding ([7c3c7f0](https://github.com/Braggiouy/ctv-bridge/commit/7c3c7f0a0594a1364313860ed0b1a0317c2eec92))

### [1.14.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.14.0...v1.14.1) (2026-11-24)


### Bug Fixes

* **project:** stop the auto-redeploy loop on Tizen ([194b709](https://github.com/Braggiouy/ctv-bridge/commit/194b7094862e139a635c68f4b9ffc69644dc248f))
* safer settings saves, debug-connection timeouts, clearer Samsung connect error ([523b060](https://github.com/Braggiouy/ctv-bridge/commit/523b060b057de537248dead946cac15cfa1d23bb))

## [1.14.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.13.0...v1.14.0) (2026-11-24)


### Features

* **project:** auto-redeploy when the project changes ([0e78182](https://github.com/Braggiouy/ctv-bridge/commit/0e781821ace7bb97ce6761a2ccca16d2c7985609))
* **remote:** colour, media and number keys ([e87fb0f](https://github.com/Braggiouy/ctv-bridge/commit/e87fb0f098f13ddbfcd11bde84a360eb4b48dad5))

## [1.13.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.12.0...v1.13.0) (2026-11-19)


### Features

* **devices:** find TVs on the network ([c5f8d23](https://github.com/Braggiouy/ctv-bridge/commit/c5f8d239b92af342e6d81b5b92c7ce3920bb9d54))
* **project:** show recent projects' full paths on hover ([c4d16df](https://github.com/Braggiouy/ctv-bridge/commit/c4d16dfaa8e594a8afb62f41432988a4c7965338))


### Bug Fixes

* **devices:** fail fast on unreachable TVs, with cancel and retry ([832c5b9](https://github.com/Braggiouy/ctv-bridge/commit/832c5b99caa6a3c2692f2695ec451b79ef048d99))
* **tizen:** let the Samsung login be cancelled while its config downloads ([a9d0380](https://github.com/Braggiouy/ctv-bridge/commit/a9d0380a6bb4b66e5bde25873a1b16d4baf2ae80))
* **tizen:** time out hung sdb calls and restart sdb ([d6e2baa](https://github.com/Braggiouy/ctv-bridge/commit/d6e2baa28355b248c0c13cde4639ab38d9492702))

## [1.12.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.11.0...v1.12.0) (2026-11-19)


### Features

* **console:** toggle the app's logs on and off ([7b0dae5](https://github.com/Braggiouy/ctv-bridge/commit/7b0dae58b17b1b4cfa24798daab76a0bf2fb04a1))
* **debug:** remote control and screenshots for the debugged app ([3a15230](https://github.com/Braggiouy/ctv-bridge/commit/3a152306f2a41d6e9fb87b99e0d826c6ab067ef7))
* **debug:** stream the app's console from the TV ([fa18f81](https://github.com/Braggiouy/ctv-bridge/commit/fa18f816602afa975858a0f87543cb0faedd06d6))


### Bug Fixes

* **debug:** remove port forwards when a debug session ends ([a4d6c4b](https://github.com/Braggiouy/ctv-bridge/commit/a4d6c4bb86b12e008f94fc1a368f5da951e8ee28))

## [1.11.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.10.0...v1.11.0) (2026-11-18)


### Features

* **debug:** open DevTools for the app in one click ([6415577](https://github.com/Braggiouy/ctv-bridge/commit/6415577fb99357b7b80f47f9c497226459c155aa))

## [1.10.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.9.0...v1.10.0) (2026-11-18)


### Features

* **ui:** replace the step wizard with a single-screen workspace ([#2](https://github.com/Braggiouy/ctv-bridge/issues/2)) ([07c670a](https://github.com/Braggiouy/ctv-bridge/commit/07c670a))
* **updater:** background updates on windows/linux, self-replacing update on macos ([#3](https://github.com/Braggiouy/ctv-bridge/issues/3)) ([10e940b](https://github.com/Braggiouy/ctv-bridge/commit/10e940b3890f10ff6f2fddec54161a90ba27215d))


### Bug Fixes

* **webos:** check connections with ares-device, as ares-device-info is deprecated ([#2](https://github.com/Braggiouy/ctv-bridge/issues/2))
* **devices:** ignore device lists that arrive after switching platform ([#2](https://github.com/Braggiouy/ctv-bridge/issues/2))

## [1.9.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.8.1...v1.9.0) (2026-11-18)


### Bug Fixes

* **webos:** stop duplicating passphrases in the keychain; kill SDK process trees ([42fc7b6](https://github.com/Braggiouy/ctv-bridge/commit/42fc7b65484b1d49ee0e0fcd8b389c3660ab39a7))

### [1.8.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.8.0...v1.8.1) (2026-10-29)


### Bug Fixes

* **ci:** ad-hoc sign the macOS app in release builds ([af9e854](https://github.com/Braggiouy/ctv-bridge/commit/af9e8548e1385c9a9bc889fe405b0cd21d8d3505))

## [1.8.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.7.2...v1.8.0) (2026-10-27)


### Features

* **updater:** install updates in-app on windows/linux and open the dmg on macos ([5d0e170](https://github.com/Braggiouy/ctv-bridge/commit/5d0e1704b87148a78e16ad16310926a0e9fc82b9))


### Bug Fixes

* **macos:** sign app ad-hoc, declare local network usage and add app icon ([c1eca40](https://github.com/Braggiouy/ctv-bridge/commit/c1eca405b42a5be6519b428f32d436cc8bc7ba6a))
* **webos:** deploy newest ipk, support sdk paths with spaces and explain EHOSTUNREACH ([9416fb8](https://github.com/Braggiouy/ctv-bridge/commit/9416fb8d62c9077a18e20a0dd12c74cf4b2ef37a))

### [1.7.2](https://github.com/Braggiouy/ctv-bridge/compare/v1.7.1...v1.7.2) (2026-08-25)


### Bug Fixes

* **webos:** improve inspector capture and qa fallback flow ([a4efc73](https://github.com/Braggiouy/ctv-bridge/commit/a4efc73f46697c34dfb2033c835427fdeebe533a))

### [1.7.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.7.0...v1.7.1) (2026-08-25)


### Bug Fixes

* **deploy:** improve debug flow and quick home navigation ([51cea8a](https://github.com/Braggiouy/ctv-bridge/commit/51cea8a48fc9d2db514ab1f141d20c2854c556ad))

## [1.7.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.6.1...v1.7.0) (2026-07-01)


### Features

* improve deploy debugging and align CI/release with bun ([e69fc7f](https://github.com/Braggiouy/ctv-bridge/commit/e69fc7fcd84335544ebf5c843e4d9821e0485c37))

### [1.6.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.6.0...v1.6.1) (2026-07-01)

### Bug Fixes

* fallback when openssl pkcs12 does not support `-legacy` ([95d724f](https://github.com/Braggiouy/ctv-bridge/commit/95d724f))
* silence baseUrl deprecation warnings in tsconfig ([9eb99b7](https://github.com/Braggiouy/ctv-bridge/commit/9eb99b7))

## [1.6.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.5.1...v1.6.0) (2026-06-08)


### Features

* improve tizen certificate and deployment release flow ([9c743a8](https://github.com/Braggiouy/ctv-bridge/commit/9c743a8426191562d35b3011f5221f0895cad46f))

### [1.5.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.5.0...v1.5.1) (2026-05-05)

## [1.5.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.4.3...v1.5.0) (2026-05-05)


### Features

* add Android support, refactor storage, and resolve security vulnerabilities ([3b53f81](https://github.com/Braggiouy/ctv-bridge/commit/3b53f8166bc5af979d82a9342369f8a3960cc54d))

### [1.4.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.4.0...v1.4.1) (2026-02-02)


### Bug Fixes

* resolve lint errors and enforce linting in release workflow ([3637b0c](https://github.com/Braggiouy/ctv-bridge/commit/3637b0cdd92b9ed08bb06dcccb7c89922dc06d11))

## [1.4.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.14...v1.4.0) (2026-02-02)


### Features

* add Android TV support, auto-launch, and setup UI improvements ([b3213bc](https://github.com/Braggiouy/ctv-bridge/commit/b3213bcf2519103bb7fa0da24725305147b594f8))

### [1.3.14](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.13...v1.3.14) (2026-01-28)

### [1.3.13](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.12...v1.3.13) (2026-01-20)

### [1.3.12](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.11...v1.3.12) (2026-01-09)

### [1.3.11](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.10...v1.3.11) (2026-01-08)

### [1.3.10](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.9...v1.3.10) (2026-01-08)

### [1.3.9](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.7...v1.3.9) (2026-01-01)


### Features

* automate tizen certificate selection and fix external link handling ([96e3805](https://github.com/Braggiouy/ctv-bridge/commit/96e3805de1b7c569497c6a06d91f33ff0b7cc166))

### [1.3.7](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.6...v1.3.7) (2026-01-01)


### Features

* add tizen certificate setup instructions to UI ([48c661f](https://github.com/Braggiouy/ctv-bridge/commit/48c661fc35c89e67f48ad27c9a83ef5fd499e7bb))

### [1.3.6](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.5...v1.3.6) (2026-01-01)

### [1.3.5](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.4...v1.3.5) (2026-01-01)


### Features

* improve deployment error reporting with detailed CLI output ([af42410](https://github.com/Braggiouy/ctv-bridge/commit/af42410ad88f2e4d9bd91034b0c176abdd0a7030))

### [1.3.4](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.10...v1.3.4) (2026-01-01)

## [1.3.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.10...v1.3.0) (2026-01-01)

### [1.2.10](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.9...v1.2.10) (2026-01-01)

### [1.2.9](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.8...v1.2.9) (2026-01-01)


### Bug Fixes

* prevent duplicate ipc registration on macos ([1e50050](https://github.com/Braggiouy/ctv-bridge/commit/1e5005005d9bef4d3e96d3f12b8ca9d834a7ed29))

### [1.2.8](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.7...v1.2.8) (2026-01-01)

### [1.2.7](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.6...v1.2.7) (2026-01-01)

### [1.2.6](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.4...v1.2.6) (2026-01-01)

### Features

- add CI, prettier and fix update button ([8a83f5d](https://github.com/Braggiouy/ctv-bridge/commit/8a83f5d9af4713da5767a148c39db5704ceccc3e))

### [1.1.4](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.3...v1.1.4) (2025-12-19)

### Bug Fixes

- change update flow to open GitHub releases instead of auto-update ([051a5d1](https://github.com/Braggiouy/ctv-bridge/commit/051a5d1a7b9302ca4882c3f876d09dbc41eae0c1))

### [1.1.3](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.2...v1.1.3) (2025-12-19)

### [1.1.2](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.1...v1.1.2) (2025-12-19)

### [1.1.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.0...v1.1.1) (2025-12-12)

## [1.1.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.0.0...v1.1.0) (2025-12-12)

### Features

- enhance project for open source and optimize CI ([f84b256](https://github.com/Braggiouy/ctv-bridge/commit/f84b256437fe04521c7aa1af4a3f006322dca427))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
