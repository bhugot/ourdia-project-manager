// Hash routes: #/ summary, #/list, #/issue/N, #/settings; the same under #/demo.
export function parseRoute(hash) {
  const h = hash || '#/';
  if (h === '#/settings') return { name: 'settings', demo: false };
  const demo = h.startsWith('#/demo');
  const path = (demo ? h.slice('#/demo'.length) : h.slice(1)) || '/';
  const issue = path.match(/^\/issue\/(\d+)$/);
  if (issue) return { name: 'issue', number: Number(issue[1]), demo };
  return { name: path === '/list' ? 'list' : 'synthesis', demo };
}
