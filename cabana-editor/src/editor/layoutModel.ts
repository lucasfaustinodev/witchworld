export type Position = [number, number, number]
export interface CabinObjectDefinition {
  id: string
  name: string
  parentId: string | null
  position: Position
  rotationY: number
  sourceId?: string
}
export interface ObjectLayout {
  position: Position
  rotationY: number
  scale: number
  visible: boolean
  deleted: boolean
  copy?: {sourceId:string;parentId:string|null}
}
export type CabinLayout = Record<string, ObjectLayout>
export const LAYOUT_SCENE = 'witchworld-cabin-artpass1-editor-v1'
export const MAX_LAYOUT_BYTES = 2 * 1024 * 1024
export const MIN_OBJECT_SCALE = .05
export const MAX_OBJECT_SCALE = 10
export const MAX_LAYOUT_OBJECTS = 1024

/** Copies keep their source mesh/paint identity in the layout, so history is complete. */
export function resolveDefinitions(definitions:readonly CabinObjectDefinition[],layout:CabinLayout):CabinObjectDefinition[] {
  const catalog=new Map(definitions.map(o=>[o.id,o]))
  return [...definitions,...Object.keys(layout).filter(id=>layout[id].copy).sort().map(id=>{
    const copy=layout[id].copy!,source=catalog.get(copy.sourceId)!
    return {...source,id,sourceId:source.id,parentId:copy.parentId,name:`${source.name} (cópia ${id.split('~copy-').at(-1)})`}
  })]
}
export function canonicalLayout(layout:CabinLayout,definitions:readonly CabinObjectDefinition[]):CabinLayout {
  return Object.fromEntries(resolveDefinitions(definitions,layout).map(o=>[o.id,layout[o.id]]))
}

export function defaultLayout(definitions: readonly CabinObjectDefinition[]): CabinLayout {
  return Object.fromEntries(definitions.map(o => [o.id, {position:[...o.position], rotationY:o.rotationY, scale:1, visible:true, deleted:false}]))
}
export function cloneLayout(layout: CabinLayout): CabinLayout {
  return Object.fromEntries(Object.entries(layout).map(([id,o]) => [id, {...o, position:[...o.position],...(o.copy?{copy:{...o.copy}}:{})}]))
}
export function sameLayout(a: CabinLayout, b: CabinLayout) { return JSON.stringify(a) === JSON.stringify(b) }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function validTransform(value: unknown): value is Record<string,unknown> & Pick<ObjectLayout,'position'|'rotationY'|'scale'> {
  if (!record(value) || !Array.isArray(value.position) || value.position.length !== 3) return false
  return value.position.every(n=>typeof n === 'number' && Number.isFinite(n) && Math.abs(n)<=10000)
    && typeof value.rotationY === 'number' && Number.isFinite(value.rotationY) && Math.abs(value.rotationY)<=1000000
    && typeof value.scale === 'number' && Number.isFinite(value.scale) && value.scale>=MIN_OBJECT_SCALE && value.scale<=MAX_OBJECT_SCALE
}
export function serializeLayout(layout: CabinLayout, definitions: readonly CabinObjectDefinition[]): string {
  return JSON.stringify({format:'witchworld-cabin-layout', version:3, scene:LAYOUT_SCENE,
    objects:resolveDefinitions(definitions,layout).map(o=>({id:o.id, parentId:o.parentId, ...layout[o.id]}))}, null, 2)
}
export function parseLayout(text: string, definitions: readonly CabinObjectDefinition[]): CabinLayout {
  if (new TextEncoder().encode(text).byteLength > MAX_LAYOUT_BYTES) throw new Error('O layout excede o limite de 2 MB.')
  let doc: unknown
  try { doc=JSON.parse(text) } catch { throw new Error('Arquivo JSON inválido.') }
  if (!record(doc) || doc.format !== 'witchworld-cabin-layout' || ![1,2,3].includes(doc.version as number) || doc.scene !== LAYOUT_SCENE || !Array.isArray(doc.objects)) throw new Error('Formato ou versão incompatível com esta cabana.')
  if (doc.objects.length>MAX_LAYOUT_OBJECTS) throw new Error(`O limite é ${MAX_LAYOUT_OBJECTS} objetos, incluindo os originais.`)
  const legacy=doc.version!==3
  const catalog=new Map(definitions.map(o=>[o.id,o])), result:CabinLayout=Object.create(null)
  for (const entry of doc.objects) {
    if (!record(entry) || typeof entry.id !== 'string' || Object.hasOwn(result,entry.id)) throw new Error('Objeto desconhecido ou ID duplicado no layout.')
    const definition=catalog.get(entry.id)
    let copy:ObjectLayout['copy']
    if(!definition) {
      if(legacy||!record(entry.copy)||typeof entry.copy.sourceId!=='string'||!catalog.has(entry.copy.sourceId)||!/^.+~copy-\d{4,}$/.test(entry.id)||entry.id!==`${entry.copy.sourceId}~copy-${entry.id.split('~copy-').at(-1)}`||entry.copy.parentId!==entry.parentId)throw new Error('Cópia ou objeto desconhecido no layout.')
      if(entry.parentId!==null&&typeof entry.parentId!=='string')throw new Error('Conjunto inválido para a cópia.')
      copy={sourceId:entry.copy.sourceId,parentId:entry.parentId as string|null}
    }else if(entry.copy!==undefined)throw new Error('Um objeto original não pode ser substituído por uma cópia.')
    const oldCurtain=legacy&&entry.id==='curtains'&&entry.parentId===null&&definition?.parentId==='window'
    const transform={position:entry.position,rotationY:entry.rotationY,scale:doc.version===1&&entry.scale===undefined?1:entry.scale}
    if ((definition&&!oldCurtain&&entry.parentId!==definition.parentId) || !validTransform(transform) || typeof entry.visible !== 'boolean' || typeof entry.deleted !== 'boolean') throw new Error(`Dados inválidos para ${definition?.name??entry.id}.`)
    const position:[number,number,number]=[...transform.position]
    // v1/v2 curtains were root objects. The new window starts at its default transform.
    if(oldCurtain){const origin=catalog.get('window')!.position;for(let i=0;i<3;i++)position[i]-=origin[i]}
    result[entry.id]={position,rotationY:transform.rotationY,scale:transform.scale,visible:entry.visible,deleted:entry.deleted,...(copy?{copy}:{})}
  }
  const defaults=defaultLayout(definitions)
  for(const definition of definitions)if(!Object.hasOwn(result,definition.id)) {
    const newFixture=definition.id==='window'||/^lamp-(library|study|hearth|entry-left|entry-right)(\/candle-001)?$/.test(definition.id)
    // This one additive prop did not exist in previously exported v3 layouts.
    if(definition.id!=='floor-cauldron'&&(!legacy||!newFixture))throw new Error('O arquivo deve conter todos os objetos originais desta cabana.')
    result[definition.id]=defaults[definition.id]
  }
  if(Object.keys(result).length>MAX_LAYOUT_OBJECTS)throw new Error(`O limite é ${MAX_LAYOUT_OBJECTS} objetos, incluindo os originais.`)
  const all=resolveDefinitions(definitions,result),expanded=new Map(all.map(o=>[o.id,o]))
  for(const o of all)if(o.sourceId) {
    const expected=catalog.get(o.sourceId)!.parentId,parent=o.parentId?expanded.get(o.parentId):null
    if((o.parentId&&!parent)||(parent?(parent.sourceId??parent.id):null)!==expected)throw new Error('Hierarquia inválida para a cópia.')
    const seen=new Set([o.id]);let ancestor=o.parentId
    while(ancestor){if(seen.has(ancestor))throw new Error('O layout contém um ciclo.');seen.add(ancestor);ancestor=expanded.get(ancestor)?.parentId??null}
  }
  return canonicalLayout(result,definitions)
}
