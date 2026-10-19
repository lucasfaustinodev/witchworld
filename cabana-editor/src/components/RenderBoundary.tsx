import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useLabStore } from '../stores/labStore.ts'

export class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('Laboratório R3F:', error)
    useLabStore.setState({ status: 'error', error: error.message })
  }
  render() {
    if (this.state.failed) return <div className="fallback" role="alert"><h2>O render não inicializou.</h2><p>Consulte o diagnóstico e confirme WebGL 2 no navegador. O Jardim original não foi afetado.</p><button onClick={() => window.location.reload()}>Tentar novamente</button></div>
    return this.props.children
  }
}
