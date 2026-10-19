import type { Object3D } from 'three'

// Future adapter boundary; intentionally no actor, control loop or gameplay here.
export interface CharacterViewHandle {
  root: Object3D
  setVisible: (visible: boolean) => void
}
