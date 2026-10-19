export type Quality = 'HIGH' | 'MEDIUM' | 'LOW'

// A quality switch replaces one composer; it never stacks rendering pipelines.
export const QUALITY = {
  HIGH: { dpr: 1.5, post: true, ao: true, bloom: true, smaa: true, shadows: true, shadowSize: 2048 },
  MEDIUM: { dpr: 1.25, post: true, ao: false, bloom: true, smaa: true, shadows: true, shadowSize: 512 },
  LOW: { dpr: 1, post: false, ao: false, bloom: false, smaa: false, shadows: false, shadowSize: 256 },
} as const satisfies Record<Quality, object>

export function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && Object.hasOwn(QUALITY, value)
}
