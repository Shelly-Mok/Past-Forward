import { handleZhihuApi } from './zhihu-bridge.mjs'

function attach(server) {
  server.middlewares.use((request, response, next) => {
    if (!request.url?.startsWith('/api/')) return next()
    handleZhihuApi(request, response).then(handled => {
      if (!handled) next()
    }).catch(next)
  })
}

export function zhihuApiPlugin() {
  return {
    name: 'life-backtest-zhihu-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}
