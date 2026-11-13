/**
 * The GitHub avatar of a user, as allowed by the Content-Security-Policy in index.html.
 * @param {string|number} githubId
 * @param {number} size In pixels, for a sharp image on high-density screens about twice the shown size
 */
export function githubAvatarUrl(githubId, size = 48) {
  return `https://avatars.githubusercontent.com/u/${encodeURIComponent(githubId)}?s=${size}`;
}
