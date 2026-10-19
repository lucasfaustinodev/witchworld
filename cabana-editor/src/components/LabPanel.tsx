import { useState } from 'react'
import { useLabStore } from '../stores/labStore.ts'
import { isQuality, QUALITY } from '../systems/quality.ts'
import { cabinMigrationSpec } from '../scenes/cabin/migrationSpec.ts'
import { EditorPanel } from '../editor/EditorPanel.tsx'

export function LabPanel() {
  const state = useLabStore()
  const [copied, setCopied] = useState(false)
  async function exportDiagnostics() {
    const data = JSON.stringify({ capturedAt: new Date().toISOString(), quality: state.quality,
      status: state.status, asset: state.assetStatus, metrics: state.metrics,
      warning: 'Intervalo de frame de navegador não mede tempo de GPU. Confirmar hardware/contexto separadamente.' }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'witchworld-r3f-diagnostico.json'; link.click()
    URL.revokeObjectURL(url)
    setCopied(true)
  }
  return <aside className="panel" aria-label="Controles do laboratório">
    <div className="panel-head"><span className="eyebrow">NEXT GEN / ART PASS 1</span><span className="badge">ISOLADO</span></div>
    <h1>Witch World<span>A cabana da bruxa</span></h1>
    <p className="intro">Madeira, tecidos e objetos com superfícies pintadas. Fantasia sombria em luz de velas, luar e magia violeta.</p>
    <EditorPanel />
    <label className="row">Qualidade
      <select value={state.quality} onChange={(event) => { if (isQuality(event.target.value)) state.setQuality(event.target.value) }}>
        <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
      </select>
    </label>
    <p className="pipeline-label">{QUALITY[state.quality].ao ? 'AO · ' : ''}{QUALITY[state.quality].post ? 'Bloom · ACES · SMAA' : 'ACES direto · sem pós-processamento'}</p>
    <button type="button" className="secondary" onClick={state.toggleAnimation}>{state.animate ? 'Pausar' : 'Ativar'} vida da cabana</button>
    <details>
      <summary>Ajustes de direção visual</summary>
      <label>Exposição <output>{state.exposure.toFixed(2)}</output><input aria-label="Exposição" type="range" min="0.6" max="1.6" step="0.02" value={state.exposure} onChange={(e) => state.setExposure(Number(e.target.value))} /></label>
      <label>Luz âmbar <output>{state.warm.toFixed(1)}</output><input aria-label="Luz âmbar" type="range" min="0" max="30" step="0.5" value={state.warm} onChange={(e) => state.setWarm(Number(e.target.value))} /></label>
      <label>Luar <output>{state.moon.toFixed(1)}</output><input aria-label="Luar" type="range" min="0" max="5" step="0.1" value={state.moon} onChange={(e) => state.setMoon(Number(e.target.value))} /></label>
      <p>Alterações apenas em memória. Não modificam o jogo ou arquivos.</p>
    </details>
    <details>
      <summary>Diagnóstico de renderização</summary>
      <p role="status">Canvas: {state.status === 'rendered' ? 'WebGL renderizando' : state.status === 'mounted' ? 'montado; aguardando primeiro frame' : state.status === 'waiting' ? 'inicializando' : state.status}.</p>
      <p>Caveira da biblioteca: {state.assetStatus === 'loaded' ? 'GLB carregado' : state.assetStatus === 'loading' ? 'carregando' : 'falha'}.</p>
      {state.metrics ? <dl>
        <dt>Draw calls / frame*</dt><dd>{state.metrics.calls}</dd>
        <dt>Triângulos / frame*</dt><dd>{state.metrics.triangles.toLocaleString('pt-BR')}</dd>
        <dt>Geometrias / materiais</dt><dd>{state.metrics.geometries} / {state.metrics.materials}</dd>
        <dt>Texturas / luzes</dt><dd>{state.metrics.textures} / {state.metrics.lights}</dd>
        <dt>Programas</dt><dd>{state.metrics.programs}</dd>
        <dt>Etapas do pipeline</dt><dd>{state.metrics.composerPasses}</dd>
        <dt>Viewport / DPR</dt><dd>{state.metrics.width} × {state.metrics.height} / {state.metrics.dpr.toFixed(2)}</dd>
        <dt>Intervalo entre frames</dt><dd>{state.metrics.frameIntervalMs.toFixed(1)} ms</dd>
      </dl> : <p>Sem amostra real de renderização ainda. Não há métricas estimadas de GPU.</p>}
      <p>*Inclui trabalho de sombras e pós-processamento. Não equivale à contagem estática da cena nem a FPS real de GPU.</p>
      <button type="button" className="secondary" disabled={!state.metrics} onClick={exportDiagnostics}>{copied ? 'Exportar novamente' : 'Exportar diagnóstico JSON'}</button>
    </details>
    <details>
      <summary>Composição e dados da cabana</summary>
      <p>Piso {cabinMigrationSpec.floor.width} × {cabinMigrationSpec.floor.depth}; seis zonas, centro aberto e entrada livre. Sete luzes, uma fonte de sombras e um único pipeline.</p>
      <p>{cabinMigrationSpec.zones.map((zone) => zone.name).join(' · ')}</p>
      {state.sceneStats && <p>Geometria da cabana: {state.sceneStats.triangles.toLocaleString('pt-BR')} triângulos em {state.sceneStats.meshes} batches / {state.sceneStats.instances} instâncias. O GLB acrescenta 6.022 triângulos. Estes são dados geométricos; os draws reais aparecem no diagnóstico.</p>}
    </details>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    <p className="footnote">Revisão visual. Movimentação da bruxa e viagem entre cenas serão integradas em outro bloco. O Jardim original está preservado.</p>
  </aside>
}
