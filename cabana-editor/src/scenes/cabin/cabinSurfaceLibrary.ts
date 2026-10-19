import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Texture } from 'three'

/** Original painted albedo art. No generated noise/height/roughness images. */
export const PAINTED_ATLAS_PATHS = ['assets/painted/cabin-wood-art-v1.png', 'assets/painted/cabin-surfaces-art-v1.png'] as const
export type CabinSurfaceKind = 'chestnut' | 'walnut' | 'oak' | 'furniture' | 'plum' | 'linen' | 'rug' | 'stone' | 'iron' | 'brass' | 'leather' | 'parchment' | 'glaze' | 'wax' | 'foliage' | 'soil' | 'potion' | 'crystal' | 'terracotta' | 'banner'
export interface PaintedCabinAtlases { wood: Texture; surfaces: Texture }
export interface CabinSurface { map: Texture; rect: readonly [number, number, number, number] }

/** Bottom-left UV origins. Inset keeps bilinear filtering inside each painting. */
export function atlasCell(column: number, row: number, grid: number): CabinSurface['rect'] {
  const inset = .006 / grid
  return [column / grid + inset, 1 - (row + 1) / grid + inset, 1 / grid - inset * 2, 1 / grid - inset * 2]
}

/** Loaded once by Drei/Suspense. Ownership stays with useTexture's cache. */
export function createCabinSurfaceLibrary(atlases?: PaintedCabinAtlases) {
  // Metadata-only textures support headless tests, never the browser scene.
  const owned = !atlases
  const maps = atlases ?? { wood: new Texture(), surfaces: new Texture() }
  const textures = [maps.wood, maps.surfaces]
  for (const [index, map] of textures.entries()) {
    map.name = index === 0 ? 'Cabin / painted wood atlas' : 'Cabin / painted surfaces atlas'
    map.colorSpace = SRGBColorSpace
    map.wrapS = map.wrapT = ClampToEdgeWrapping
    map.minFilter = LinearMipmapLinearFilter
    map.magFilter = LinearFilter
    map.generateMipmaps = true
    map.anisotropy = 4
    map.userData.artSource = PAINTED_ATLAS_PATHS[index]
    map.needsUpdate = true
  }
  const surfaces = {} as Record<CabinSurfaceKind, CabinSurface>
  const wood = ['chestnut', 'walnut', 'oak', 'furniture'] as const
  const props = ['plum', 'linen', 'rug', 'stone', 'iron', 'brass', 'leather', 'parchment', 'glaze', 'wax', 'foliage', 'soil', 'potion', 'crystal', 'terracotta', 'banner'] as const
  wood.forEach((kind, i) => { surfaces[kind] = { map: maps.wood, rect: atlasCell(i % 2, Math.floor(i / 2), 2) } })
  props.forEach((kind, i) => { surfaces[kind] = { map: maps.surfaces, rect: atlasCell(i % 4, Math.floor(i / 4), 4) } })
  let disposed = false
  return { surfaces, textures, dispose() {
    if (disposed) return
    disposed = true
    if (owned) textures.forEach((map) => map.dispose())
  } }
}
