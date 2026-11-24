// Count of questions waiting for Ben: on the home-screen icon where the browser allows it
// (Badging API), and always in the page title.
const TITLE = 'Ourdia — suivi';

export async function showCount(count, doc = document, nav = navigator) {
  doc.title = count ? `(${count}) ${TITLE}` : TITLE;
  try {
    if (count && nav.setAppBadge) await nav.setAppBadge(count);
    else if (!count && nav.clearAppBadge) await nav.clearAppBadge();
  } catch {
    // Badge refused (no notification permission on iOS): the title still shows the count.
  }
}

/** 'unsupported', 'needs-permission' or 'ready'. */
export function badgeSupport(win = globalThis) {
  if (!win.navigator?.setAppBadge) return 'unsupported';
  if (win.Notification && win.Notification.permission !== 'granted') return 'needs-permission';
  return 'ready';
}
