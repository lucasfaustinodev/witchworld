import { useEffect, useRef, useState } from 'react'
import { cabinEditorStore, useCabinEditor } from './editorStore.ts'
import type { CabinEditorState } from './editorStore.ts'
import { MAX_LAYOUT_BYTES, MIN_OBJECT_SCALE, MAX_OBJECT_SCALE, serializeLayout, resolveDefinitions } from './layoutModel.ts'
import type { CabinObjectDefinition } from './layoutModel.ts'

function NumericField({label,value,onCommit,min=-10000,max=10000,step=.05}:{label:string;value:number;onCommit:(value:number)=>void;min?:number;max?:number;step?:number}) {
  const [text,setText]=useState(String(value))
  useEffect(()=>setText(String(value)),[value])
  return <label className="editor-number">{label}<input type="number" min={min} max={max} step={step} value={text}
    onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}
    onBlur={()=>{if(text===String(value))return;const next=Number(text);if(text.trim() && Number.isFinite(next) && next>=min && next<=max)onCommit(next);else setText(String(value))}} /></label>
}

export function EditorPanel() {
  const state=useCabinEditor(s=>s)
  return <EditorPanelView state={state} />
}

/** The DOM view also accepts a snapshot for SSR checks without a WebGL canvas. */
export function EditorPanelView({state:s}:{state:CabinEditorState}) {
  const fileRef=useRef<HTMLInputElement>(null)
  const [filter,setFilter]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
  const definitions=resolveDefinitions(s.definitions,s.layout)
  const selected=definitions.find(o=>o.id===s.selectedId), value=selected?s.layout[selected.id]:null
  const children=new Map<string|null,CabinObjectDefinition[]>()
  for(const o of definitions){if(!children.has(o.parentId))children.set(o.parentId,[]);children.get(o.parentId)!.push(o)}
  const matches=(o:CabinObjectDefinition):boolean=>!filter||o.name.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR'))||(children.get(o.id)??[]).some(matches)
  const tree=(parentId:string|null)=><ul>{(children.get(parentId)??[]).filter(matches).map(o=><li key={o.id}>
    <button type="button" disabled={s.dragging} className={`editor-tree-object ${s.selectedId===o.id?'is-selected':''} ${s.layout[o.id].deleted?'is-deleted':''}`}
      aria-pressed={s.selectedId===o.id} onClick={()=>s.select(o.id)}>
      <span>{o.name}</span><small>{s.layout[o.id].deleted?'excluído':!s.layout[o.id].visible?'oculto':''}</small>
    </button>{children.has(o.id)&&tree(o.id)}</li>)}</ul>
  const update=(patch:Parameters<typeof s.updateObject>[1])=>{
    if(!selected)return
    try{s.updateObject(selected.id,patch);setNotice('')}catch(e){setNotice(e instanceof Error?e.message:'Valor inválido.')}
  }
  function download() {
    const live=cabinEditorStore.getState()
    const url=URL.createObjectURL(new Blob([serializeLayout(live.layout,live.definitions)],{type:'application/json'}))
    const link=document.createElement('a');link.href=url;link.download='witchworld-cabana-layout-v3.json';link.click()
    window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    setNotice('Layout exportado. Guarde o JSON para restaurar esta composição.')
  }
  return <section className={`editor-panel ${s.enabled?'is-editing':''}`} aria-label="Editor da cabana">
    <button type="button" className="secondary editor-toggle" aria-pressed={s.enabled} onClick={()=>s.setEnabled(!s.enabled)}>{s.enabled?'Concluir edição':'Editar móveis e objetos'}</button>
    {s.enabled&&<>
      <p className="editor-help">Clique para selecionar. Use Mover no piso, Altura na vertical ou Tamanho para redimensionar proporcionalmente. Shift + clique seleciona o conjunto.</p>
      <div className="editor-toolbar" role="group" aria-label="Ferramentas">
        <button type="button" disabled={s.dragging} aria-pressed={s.mode==='translate'} onClick={()=>s.setMode('translate')}>Mover · W</button>
        <button type="button" disabled={s.dragging} aria-pressed={s.mode==='height'} onClick={()=>s.setMode('height')}>Altura · H</button>
        <button type="button" disabled={s.dragging} aria-pressed={s.mode==='rotate'} onClick={()=>s.setMode('rotate')}>Girar · R</button>
        <button type="button" disabled={s.dragging} aria-pressed={s.mode==='scale'} onClick={()=>s.setMode('scale')}>Tamanho · S</button>
        <button type="button" disabled={!s.undoStack.length||s.dragging} onClick={s.undo}>Desfazer</button>
        <button type="button" disabled={!s.redoStack.length||s.dragging} onClick={s.redo}>Refazer</button>
      </div>
      <div className="editor-inspector">
        <h2>{selected?.name??'Selecione um objeto'}</h2>
        {selected&&value?<>
          <code className="editor-object-id">{selected.id}</code>
          <p className="editor-coordinate-note">{selected.parentId?'Posição relativa ao móvel ou conjunto.':'Posição na cabana.'} Valores atualizados ao soltar.</p>
          <fieldset disabled={s.dragging}><legend>Posição, altura, rotação e tamanho</legend><div className="editor-number-grid">
            {(['X','Y','Z'] as const).map((axis,index)=><NumericField key={`${selected.id}-${axis}`} label={axis==='Y'?'Altura (Y)':axis} value={value.position[index]} onCommit={next=>{const position=[...value.position] as [number,number,number];position[index]=next;update({position})}} />)}
            <NumericField key={`${selected.id}-rotation`} label="Giro (°)" value={value.rotationY*180/Math.PI} onCommit={degrees=>update({rotationY:degrees*Math.PI/180})} />
            <NumericField key={`${selected.id}-size`} label="Tamanho (%)" value={value.scale*100} min={MIN_OBJECT_SCALE*100} max={MAX_OBJECT_SCALE*100} step={5} onCommit={percent=>update({scale:percent/100})} />
          </div>
          <div className="editor-toolbar">
            <button type="button" onClick={()=>update({rotationY:value.rotationY-Math.PI/12})}>−15°</button>
            <button type="button" onClick={()=>update({rotationY:value.rotationY+Math.PI/12})}>+15°</button>
            <button type="button" onClick={()=>update({scale:Math.max(MIN_OBJECT_SCALE,value.scale*.9)})}>Tamanho −10%</button>
            <button type="button" onClick={()=>update({scale:Math.min(MAX_OBJECT_SCALE,value.scale*1.1)})}>Tamanho +10%</button>
            <button type="button" onClick={()=>update({visible:!value.visible})}>{value.visible?'Ocultar':'Mostrar'}</button>
            <button type="button" disabled={value.deleted||!value.visible} onClick={()=>{try{s.duplicateObject(selected.id);setNotice('Cópia criada e selecionada, incluindo os props do conjunto.')}catch(error){setNotice(error instanceof Error?error.message:'Não foi possível duplicar.')}}}>Duplicar item</button>
            <button type="button" className={value.deleted?'':'editor-danger'} onClick={()=>update({deleted:!value.deleted})}>{value.deleted?'Restaurar objeto':'Excluir objeto'}</button>
          </div>
          {selected.parentId&&<button type="button" className="editor-parent" onClick={()=>s.select(selected.parentId)}>Selecionar conjunto: {definitions.find(o=>o.id===selected.parentId)?.name}</button>}
          </fieldset>
          {value.deleted&&<p>Exclusão reversível. O objeto continua no JSON e na árvore.</p>}
        </>:<p>Escolha na cena ou na árvore abaixo. Props pequenos podem ser selecionados separadamente.</p>}
      </div>
      <details className="editor-tree" open><summary>Objetos editáveis · {definitions.length}</summary>
        <label className="editor-search">Buscar objeto<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} /></label>
        <div className="editor-tree-scroll" aria-label="Árvore de objetos editáveis">{tree(null)}</div>
      </details>
      <div className="editor-toolbar editor-files">
        <button type="button" disabled={s.dragging||busy||!s.definitions.length} onClick={download}>Exportar JSON</button>
        <button type="button" disabled={s.dragging||busy||!s.definitions.length} onClick={()=>fileRef.current?.click()}>{busy?'Importando…':'Importar JSON'}</button>
        <button type="button" disabled={s.dragging||busy} onClick={()=>{s.resetLayout();setNotice('Layout original restaurado. Você pode desfazer.')}}>Restaurar layout original</button>
      </div>
      <input ref={fileRef} type="file" hidden accept=".json,application/json" aria-label="Importar arquivo de layout" onChange={async e=>{
        const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(!file)return
        setBusy(true)
        try{if(file.size>MAX_LAYOUT_BYTES)throw new Error('O arquivo excede 2 MB.');const text=await file.text();cabinEditorStore.getState().importLayout(text);setNotice('Layout importado. Você pode desfazer.')}
        catch(error){setNotice(error instanceof Error?error.message:'Não foi possível importar.')}
        finally{setBusy(false)}
      }} />
      <p className="editor-notice" role="status" aria-live="polite">{notice||'Alterações ficam nesta sessão. Exporte o JSON antes de fechar ou recarregar.'}</p>
      <p className="editor-shortcuts">Ctrl/⌘ Z: desfazer · Shift Ctrl/⌘ Z: refazer · Delete: excluir · Esc: cancelar arraste.</p>
    </>}
  </section>
}
