// Extracted from v44 cabin-interior.js. Data seam only: no room reconstruction.
export const cabinMigrationSpec = {
  sourceVersion: 44,
  sourceCommit: '723ce1810be10840749d89378c08d634de021065',
  floor: { width: 10.4, depth: 8.4, top: 0.028 },
  camera: { target: [0, 1.18, 0], offset: [10, 12.95, 20], near: 0.1, far: 80 },
  spawn: [0, 0.038, 3.15], exit: [0, 0.038, 3.5],
  baseline: { trianglesWithoutActor: 19564, meshes: 51, instances: 960, geometries: 21, materials: 25, lights: 7, shadowLights: 1 },
  zones: [
    { id: 'rest', name: 'Descanso', center: [-3.7, 0, -1.08], futureComponent: 'RestZone' },
    { id: 'library', name: 'Biblioteca', center: [-3.2, 0, -3.7], futureComponent: 'LibraryZone' },
    { id: 'study', name: 'Grimório', center: [0.7, 0, -3.05], futureComponent: 'StudyZone' },
    { id: 'alchemy', name: 'Alquimia e lareira', center: [4.08, 0, -2.81], futureComponent: 'AlchemyZone' },
    { id: 'meditation', name: 'Meditação central', center: [0, 0, 0.36], futureComponent: 'MeditationZone' },
    { id: 'entry', name: 'Entrada e armazenamento', center: [0, 0, 3.5], futureComponent: 'EntryZone' },
  ],
  artDirection: ['dark fantasy stylized', 'madeira escura', 'âmbar localizado', 'luar azul', 'violeta concentrado', 'circulação ampla'],
  preserveInterfaces: ['spawn', 'exit', 'points', 'obstacles', 'navigation', 'setSize', 'update'],
} as const
