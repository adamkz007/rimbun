// Remembers whether the desktop navigation rail is collapsed, as a cookie so
// the server renders the saved state and the menu doesn't jump on load.
export const NAV_COOKIE = "rimbun_nav";

export function isNavCollapsed(value: string | undefined) {
  return value === "collapsed";
}
