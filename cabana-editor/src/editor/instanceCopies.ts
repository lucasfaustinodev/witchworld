import type { CabinBatch } from '../scenes/cabin/buildCabinLayout.ts'
import type { CabinObjectDefinition } from './layoutModel.ts'

/** Every rendered instance retains its source UV crop and its own raycast owner. */
export function expandBatchInstances(batch:CabinBatch,definitions:readonly CabinObjectDefinition[]) {
  const copies=new Map<string,string[]>()
  for(const o of definitions)if(o.sourceId){if(!copies.has(o.sourceId))copies.set(o.sourceId,[]);copies.get(o.sourceId)!.push(o.id)}
  return batch.ownerIds.flatMap((ownerId,sourceIndex)=>[
    {sourceIndex,ownerId},...(ownerId?copies.get(ownerId)??[]:[]).map(id=>({sourceIndex,ownerId:id})),
  ])
}
