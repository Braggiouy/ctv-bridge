/** Where CTV Bridge lives on GitHub, for the main process and the renderer. */
export const AUTHOR = "Braggiouy";
export const AUTHOR_URL = `https://github.com/${AUTHOR}`;
export const REPO_URL = `${AUTHOR_URL}/ctv-bridge`;
export const NEW_ISSUE_URL = `${REPO_URL}/issues/new/choose`;
export const releaseUrl = (version: string) =>
  `${REPO_URL}/releases/tag/v${version}`;
