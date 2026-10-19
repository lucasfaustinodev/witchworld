import { create } from 'zustand'
import type { Quality } from '../systems/quality.ts'

export interface FrameMetrics {
  calls: number
  triangles: number
  geometries: number
  textures: number
  lights: number
  materials: number
  programs: number
  composerPasses: number
  passNames: string[]
  frameIntervalMs: number
  width: number
  height: number
  dpr: number
  renderer: string
}

interface LabState {
  sceneStats: { triangles: number; meshes: number; instances: number; geometries: number; materials: number } | null
  quality: Quality
  exposure: number
  warm: number
  moon: number
  animate: boolean
  boil: boolean
  status: 'waiting' | 'mounted' | 'rendered' | 'lost' | 'error'
  assetStatus: 'loading' | 'loaded' | 'error'
  error: string | null
  metrics: FrameMetrics | null
  pipelinePassNames: string[]
  setQuality: (value: Quality) => void
  setExposure: (value: number) => void
  setWarm: (value: number) => void
  setMoon: (value: number) => void
  toggleAnimation: () => void
}

export const useLabStore = create<LabState>((set) => ({
  quality: 'HIGH', exposure: 1.12, warm: 15, moon: 2.6, animate: false, boil: true,
  status: 'waiting', assetStatus: 'loading', error: null, metrics: null, pipelinePassNames: [], sceneStats: null,
  setQuality: (quality) => set({ quality, metrics: null }),
  setExposure: (exposure) => set({ exposure: Math.min(1.6, Math.max(0.6, exposure)) }),
  setWarm: (warm) => set({ warm: Math.min(30, Math.max(0, warm)) }),
  setMoon: (moon) => set({ moon: Math.min(5, Math.max(0, moon)) }),
  toggleAnimation: () => set((state) => ({ animate: !state.animate, boil: !state.animate })),
}))
