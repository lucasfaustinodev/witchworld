import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { canonicalLayout, cloneLayout, defaultLayout, MAX_LAYOUT_OBJECTS, parseLayout, resolveDefinitions, sameLayout, validTransform } from './layoutModel.ts'
import type { CabinLayout, CabinObjectDefinition, ObjectLayout } from './layoutModel.ts'

export interface CabinEditorState {
  definitions: readonly CabinObjectDefinition[]
  layout: CabinLayout
  enabled: boolean
  mode: 'translate' | 'height' | 'rotate' | 'scale'
  selectedId: string | null
  dragging: boolean
  undoStack: CabinLayout[]
  redoStack: CabinLayout[]
  initialize: (definitions: readonly CabinObjectDefinition[], initialLayout?:CabinLayout) => void
  setEnabled: (enabled:boolean) => void
  setMode: (mode:CabinEditorState['mode']) => void
  select: (id:string|null) => void
  updateObject: (id:string, patch:Partial<ObjectLayout>) => void
  duplicateObject: (id:string) => string | null
  beginGesture: (id:string) => void
  previewTransform: (id:string, patch:Partial<Pick<ObjectLayout,'position'|'rotationY'|'scale'>>) => void
  commitGesture: () => void
  cancelGesture: () => void
  getLiveLayout: () => CabinLayout
  getRevision: () => number
  undo: () => void
  redo: () => void
  resetLayout: () => void
  importLayout: (text:string) => void
}

export function createCabinEditorStore() {
  let draft:CabinLayout|null=null, gestureId:string|null=null, revision=0, baseline:CabinLayout|null=null
  return createStore<CabinEditorState>((set,get)=>{
    const commit=(next:CabinLayout)=>{
      const s=get()
      if (sameLayout(s.layout,next)) return
      revision++
      set({layout:next,selectedId:s.selectedId&&next[s.selectedId]?s.selectedId:null,undoStack:[...s.undoStack,s.layout].slice(-100),redoStack:[]})
    }
    const cancel=()=>{draft=null;gestureId=null;revision++;set({dragging:false})}
    const edited=(layout:CabinLayout,id:string,patch:Partial<ObjectLayout>)=>{
      if (!Object.hasOwn(layout,id)) throw new Error('Este objeto não é editável.')
      const value={...layout[id],...patch,copy:layout[id].copy,position:[...(patch.position??layout[id].position)]}
      if(!value.copy)delete value.copy
      if (!validTransform(value) || typeof value.visible!=='boolean' || typeof value.deleted!=='boolean') throw new Error('Transformação inválida.')
      return {...layout,[id]:value}
    }
    return {
      definitions:[],layout:{},enabled:false,mode:'translate',selectedId:null,dragging:false,undoStack:[],redoStack:[],
      initialize(definitions,initialLayout) {
        if (JSON.stringify(get().definitions)===JSON.stringify(definitions)) return
        draft=null;gestureId=null;revision++
        baseline=cloneLayout(initialLayout??defaultLayout(definitions))
        set({definitions,layout:cloneLayout(baseline),undoStack:[],redoStack:[],selectedId:null,dragging:false})
      },
      setEnabled(enabled){cancel();set({enabled,selectedId:enabled?get().selectedId:null})},
      setMode(mode){if(!get().dragging)set({mode})},
      select(id){if(id && !Object.hasOwn(get().layout,id))return;if(!get().dragging)set({selectedId:id})},
      updateObject(id,patch){if(!get().dragging)commit(edited(get().layout,id,patch))},
      duplicateObject(id){
        const s=get()
        if(s.dragging)return null
        if(!Object.hasOwn(s.layout,id))throw new Error('Selecione um objeto editável.')
        const all=resolveDefinitions(s.definitions,s.layout),catalog=new Map(all.map(o=>[o.id,o]))
        let current:string|null=id
        while(current){const value=s.layout[current];if(value.deleted||!value.visible)throw new Error('Mostre ou restaure o conjunto antes de duplicar.');current=catalog.get(current)!.parentId}
        const subtree=all.filter(o=>{let at:string|null=o.id;while(at){if(at===id)return true;at=catalog.get(at)!.parentId}return false})
        if(all.length+subtree.length>MAX_LAYOUT_OBJECTS)throw new Error(`O limite é ${MAX_LAYOUT_OBJECTS} objetos, incluindo props dos conjuntos.`)
        let sequence=1
        const ids=new Map<string,string>()
        for(const o of subtree){const source=o.sourceId??o.id;let next:string;do{next=`${source}~copy-${String(sequence++).padStart(4,'0')}`}while(s.layout[next]||[...ids.values()].includes(next));ids.set(o.id,next)}
        const next=cloneLayout(s.layout)
        for(const o of subtree){const copyId=ids.get(o.id)!,value=s.layout[o.id];next[copyId]={...value,position:[...value.position],copy:{sourceId:o.sourceId??o.id,parentId:o.parentId?(ids.get(o.parentId)??o.parentId):null}}}
        const copyId=ids.get(id)!
        for(const axis of [0,2]){const value=next[copyId].position[axis];next[copyId].position[axis]+=value+.35>10000?-.35:.35}
        commit(canonicalLayout(next,s.definitions));set({selectedId:copyId});return copyId
      },
      beginGesture(id){
        if(get().dragging || !Object.hasOwn(get().layout,id))return
        draft=cloneLayout(get().layout);gestureId=id;set({dragging:true,selectedId:id})
      },
      previewTransform(id,patch){if(draft && gestureId===id){draft=edited(draft,id,patch);revision++}},
      commitGesture(){const next=draft;draft=null;gestureId=null;set({dragging:false});if(next)commit(next);revision++},
      cancelGesture:cancel,
      getLiveLayout:()=>draft??get().layout,
      getRevision:()=>revision,
      undo(){if(get().dragging)return;const s=get(),previous=s.undoStack.at(-1);if(!previous)return;revision++;set({layout:previous,selectedId:s.selectedId&&previous[s.selectedId]?s.selectedId:null,undoStack:s.undoStack.slice(0,-1),redoStack:[...s.redoStack,s.layout].slice(-100)})},
      redo(){if(get().dragging)return;const s=get(),next=s.redoStack.at(-1);if(!next)return;revision++;set({layout:next,selectedId:s.selectedId&&next[s.selectedId]?s.selectedId:null,redoStack:s.redoStack.slice(0,-1),undoStack:[...s.undoStack,s.layout].slice(-100)})},
      resetLayout(){if(!get().dragging)commit(cloneLayout(baseline??defaultLayout(get().definitions)))},
      importLayout(text){if(get().dragging)throw new Error('Solte o objeto antes de importar.');commit(parseLayout(text,get().definitions))},
    }
  })
}
export const cabinEditorStore=createCabinEditorStore()
export function useCabinEditor<T>(selector:(state:CabinEditorState)=>T) { return useStore(cabinEditorStore,selector) }
