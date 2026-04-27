
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: 'https://zemachin.github.io/wom-hiscores/',
  locale: undefined,
  routes: [
  {
    "renderMode": 0,
    "route": "/wom-hiscores/hiscores"
  },
  {
    "renderMode": 0,
    "route": "/wom-hiscores/hiscores/*"
  },
  {
    "renderMode": 0,
    "route": "/wom-hiscores/hiscores/*/*"
  },
  {
    "renderMode": 0,
    "route": "/wom-hiscores/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 1615, hash: 'fa729885b5b54aa8afb2c012346fe76f92a358c2d0fb27bfe0ea8a44ea8185aa', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1047, hash: '3d0e9574db7ca28d5362dd5ac2958fc5681d9e62e6024015c76dd0a600204db2', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-YH3AULX2.css': {size: 4261, hash: '0UHuje130a8', text: () => import('./assets-chunks/styles-YH3AULX2_css.mjs').then(m => m.default)}
  },
};
