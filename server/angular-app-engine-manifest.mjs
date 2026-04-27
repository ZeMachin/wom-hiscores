
export default {
  basePath: 'https://zemachin.github.io/wom-hiscores',
  allowedHosts: [],
  supportedLocales: {
  "en-US": ""
},
  entryPoints: {
    '': () => import('./main.server.mjs')
  },
};
