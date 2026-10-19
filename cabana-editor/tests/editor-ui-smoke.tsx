import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { EditorPanelView } from '../src/editor/EditorPanel.tsx'
import { cabinEditorStore } from '../src/editor/editorStore.ts'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'

const model=buildCabinLayout(),s=()=>cabinEditorStore.getState()
try {
  s().initialize(model.objects)
  let html=renderToStaticMarkup(<EditorPanelView state={s()} />)
  assert.ok(html.includes('Editar móveis e objetos'))
  assert.ok(!html.includes('Árvore de objetos editáveis'))
  s().setEnabled(true);s().select('study-desk')
  html=renderToStaticMarkup(<EditorPanelView state={s()} />)
  for(const text of ['Árvore de objetos editáveis','Exportar JSON','Importar JSON','Restaurar layout original','Excluir objeto','Duplicar item','Giro (°)','Escrivaninha','Altura · H','Tamanho · S','Altura (Y)','Tamanho (%)','Janela e cortinas','Lamparina esquerda da entrada']) assert.ok(html.includes(text),text)
  assert.ok((html.match(/editor-tree-object/g)??[]).length===model.objects.length)
  s().updateObject('study-desk',{deleted:true})
  html=renderToStaticMarkup(<EditorPanelView state={s()} />)
  assert.ok(html.includes('Restaurar objeto')&&html.includes('is-deleted'))
  s().undo();s().beginGesture('study-desk')
  html=renderToStaticMarkup(<EditorPanelView state={s()} />)
  assert.ok(html.includes('<fieldset disabled=""'))
  s().cancelGesture();s().updateObject('study-desk',{deleted:false})
  const copyId=s().duplicateObject('study-desk')!
  html=renderToStaticMarkup(<EditorPanelView state={s()} />)
  assert.ok(html.includes(copyId)&&html.includes('cópia'))
  assert.ok((html.match(/editor-tree-object/g)??[]).length>model.objects.length)
  s().undo();s().resetLayout()
  assert.doesNotThrow(()=>renderToStaticMarkup(<EditorPanelView state={s()} />))
  console.log(`Editor UI SSR smoke: ${model.objects.length}-object tree, duplicate controls/copies, numeric fields, files, reversible deletion and drag-disabled fields passed. No browser/WebGL interaction claimed.`)
} finally {model.dispose()}
