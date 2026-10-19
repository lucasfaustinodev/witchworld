import { renderToString } from 'react-dom/server'
import assert from 'node:assert/strict'
import App from '../src/App.tsx'

// SSR validates React/import/DOM startup only. It does NOT validate Canvas/WebGL.
const html = renderToString(<App />)
assert.match(html, /A cabana da bruxa/)
assert.match(html, /Cabana completa R3F isométrica/)
assert.match(html, /HIGH/)
assert.match(html, /MEDIUM/)
assert.match(html, /LOW/)
console.log('React 19 SSR: App, painel e contêiner Canvas inicializados. WebGL não executado neste teste.')
