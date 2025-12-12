# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.4.3](https://github.com/Braggiouy/ctv-bridge/compare/v1.4.2...v1.4.3) (2025-12-01)

### [1.4.2](https://github.com/Braggiouy/ctv-bridge/compare/v1.4.1...v1.4.2) (2025-12-01)


### Bug Fixes

* disable code signing validation for macOS updates ([28cef80](https://github.com/Braggiouy/ctv-bridge/commit/28cef80050c14eed44a9217867283021b9a4c4ce))

### [1.4.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.4.0...v1.4.1) (2025-12-01)


### Bug Fixes

* standardize artifact naming and improve update UI ([ea74763](https://github.com/Braggiouy/ctv-bridge/commit/ea74763768d853477c6eec1497843527db6878f1))

## [1.4.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.3...v1.4.0) (2025-12-01)


### Features

* fix webOS SDK path resolution and enhance README ([ab16b31](https://github.com/Braggiouy/ctv-bridge/commit/ab16b318b8dca27fae8e3ac65eadb7e2fb316111))
* implement SDK path resolution and remove PATH requirement ([f1f3906](https://github.com/Braggiouy/ctv-bridge/commit/f1f390606d94d533eb564ca10e087fbbe3a9e4df))


### Bug Fixes

* configure for public repository to enable auto-updates ([2b0c05a](https://github.com/Braggiouy/ctv-bridge/commit/2b0c05a1f31555b9a2c9b5dc8f8517778ab6a211))

### [1.3.3](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.2...v1.3.3) (2025-12-01)


### Bug Fixes

* configure electron-updater for private repository ([6171f0e](https://github.com/Braggiouy/ctv-bridge/commit/6171f0e3e228ab5eaf4c31e1198d3a12f980df57))

### [1.3.2](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.1...v1.3.2) (2025-12-01)


### Bug Fixes

* remove test job from release workflow ([583aa51](https://github.com/Braggiouy/ctv-bridge/commit/583aa511b07457500ba4f8e509ae0dec0f38928b))

### [1.3.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.3.0...v1.3.1) (2025-12-01)


### Bug Fixes

* build errors, missing components and import paths ([30b3452](https://github.com/Braggiouy/ctv-bridge/commit/30b34522ef8e88716d903b4b27a16440d4135936))
* **ci:** upload only necessary release files to avoid duplicates ([d76adda](https://github.com/Braggiouy/ctv-bridge/commit/d76adda62c02001a09f83f17deecf96dff0405d5))

## [1.3.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.5...v1.3.0) (2025-11-28)


### Features

* add auto-update UI button to navbar and restore update metadata ([a940710](https://github.com/Braggiouy/ctv-bridge/commit/a940710f99b85e5717517151f8606073506336bb))
* add intuitive auto-update UI with icon, tooltip, and polished dialog ([69277fb](https://github.com/Braggiouy/ctv-bridge/commit/69277fb5d8265b1df0dc40f89dca62dfb51285bd))


### Bug Fixes

* correct utils import path in dropdown-menu ([be2886a](https://github.com/Braggiouy/ctv-bridge/commit/be2886a4c806db0ab801b21d53f3547a0e0022f3))

### [1.2.5](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.4...v1.2.5) (2025-11-28)


### Bug Fixes

* **ci:** strictly filter release artifacts to exe, dmg, and AppImage only ([3cd9f88](https://github.com/Braggiouy/ctv-bridge/commit/3cd9f881a761e7759d7167e9cd9d57399d37821b))

### [1.2.4](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.3...v1.2.4) (2025-11-28)


### Bug Fixes

* **ci:** disable electron-builder publish in build step ([367fe77](https://github.com/Braggiouy/ctv-bridge/commit/367fe775e09274410c59b668533f8051830cf85c))
* **ci:** filter release artifacts to exclude build intermediates ([8290909](https://github.com/Braggiouy/ctv-bridge/commit/82909092d7a0fa574e151fb87334c0943c2b0d3f))

### [1.2.3](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.2...v1.2.3) (2025-11-28)


### Bug Fixes

* **ci:** use npm pkg set to avoid error on identical version ([17ff542](https://github.com/Braggiouy/ctv-bridge/commit/17ff54234854e21a269e4051d6a9159a98c20848))

### [1.2.2](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.1...v1.2.2) (2025-11-28)

## [1.2.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.2.0...v1.2.1) (2025-11-26)


### Bug Fixes

* **build:** Explicitly set identity to null for ad-hoc signing ([114a2e3](https://github.com/Braggiouy/ctv-bridge/commit/114a2e39df4de56275dc4200754872182e863dfd))

# [1.2.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.1.0...v1.2.0) (2025-11-26)


### Bug Fixes

* **ci:** Enforce build success before release ([50f4d65](https://github.com/Braggiouy/ctv-bridge/commit/50f4d65be64ce9f75226799d98b9bc884c0e2ef0))
* **ci:** Pass GITHUB_TOKEN to reusable build workflow ([fc2ac26](https://github.com/Braggiouy/ctv-bridge/commit/fc2ac26c5503efd79eddeba2c5b1c4ecff70e639))
* **ci:** Sync build version with semantic-release ([e402f1f](https://github.com/Braggiouy/ctv-bridge/commit/e402f1f92d84ecc3a0fb9dace77e66fed0d6496c))
* **tizen:** improve error handling and logging for Tizen operations ([ffa5d9e](https://github.com/Braggiouy/ctv-bridge/commit/ffa5d9ef1005916ffcbd65a111571eefaa7e07ea))


### Features

* implement auto-update system with electron-updater ([3cf03c6](https://github.com/Braggiouy/ctv-bridge/commit/3cf03c6acc3ea248abacb151399237a36653fdf7))
* redesign UI with minimal branding and add test coverage ([406da29](https://github.com/Braggiouy/ctv-bridge/commit/406da29efe5b91a1f8fa36786263fbf04b52b5ba))

# [1.1.0](https://github.com/Braggiouy/ctv-bridge/compare/v1.0.1...v1.1.0) (2025-11-22)

### Bug Fixes

- update releaserc artifact paths ([a36efcb](https://github.com/Braggiouy/ctv-bridge/commit/a36efcb344911a2abea98af0c73cddd2dd51be73))

### Features

- consolidate platform builds into single release workflow ([b4e9897](https://github.com/Braggiouy/ctv-bridge/commit/b4e98976bb0f950a27575f9082ba8147ff887ad3))

## [1.0.1](https://github.com/Braggiouy/ctv-bridge/compare/v1.0.0...v1.0.1) (2025-11-22)

### Bug Fixes

- build full packages instead of unpacked directories ([d292773](https://github.com/Braggiouy/ctv-bridge/commit/d292773078cb28a851db5005f235cb05187c8dd0))
- disable electron-builder publishing via config ([5e2547c](https://github.com/Braggiouy/ctv-bridge/commit/5e2547c93ca5d2fc0defcebf742f4f2def9512db))
- use bunx to run build commands ([59d8fff](https://github.com/Braggiouy/ctv-bridge/commit/59d8fffe8bfde1edca9abb9c6525a63b8cab6ee5))

# 1.0.0 (2025-11-22)

### Bug Fixes

- add author email for Linux package builds ([aee5e35](https://github.com/Braggiouy/ctv-bridge/commit/aee5e358843e0eb6a392556972cd54fa21db5558))
- add Node.js 22 setup for semantic-release ([20e2e86](https://github.com/Braggiouy/ctv-bridge/commit/20e2e86fc4aeb4f373b69c89f3c44e27f9c897d5))
- configure build to skip auto-publish and fix asset paths ([e89e914](https://github.com/Braggiouy/ctv-bridge/commit/e89e9141654fc47f6b78b9430cb24806a7565e1c))
- switch CI to use Bun instead of npm ([9345384](https://github.com/Braggiouy/ctv-bridge/commit/93453840330e027385ed4c35c37cc9629f45db12))
- workflow node version and readme update ([cd904bb](https://github.com/Braggiouy/ctv-bridge/commit/cd904bbe90511d20cc38e62f5d76fdc28c799630))

### Features

- setup release workflow ([5d2961e](https://github.com/Braggiouy/ctv-bridge/commit/5d2961e4f07b2bcffeed775a9a931e5739dcc42d))

# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2025-11-22

### Changed

- **Rebranding**: Renamed project from "Smart TV Deployer" to **CTV Bridge**.
- **UI**: Unified Device Management UI for Tizen and webOS.
- **UX**: Improved build path selection (direct click instead of select button).

### Added

- **webOS Support**: Full support for building, installing, and launching webOS applications (`.ipk`).
- **Debug Mode**: Added support for webOS debug mode using `ares-inspect` (captures and displays Chrome DevTools URL).
- **Device Management**: Added ability to register, edit, and remove webOS devices directly from the app.
- **Connection Testing**: Added SSH key setup automation for webOS devices.

### Fixed

- **Build**: Fixed `ares-package` execution path to correctly generate IPK files.
- **Build**: Fixed issue where old IPK files were being selected.
- **Logs**: Removed duplicate timestamps in log output.
- **Deploy**: Fixed "Unknown platform" error during deployment.
