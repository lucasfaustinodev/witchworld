declare module '*vendor/addons/loaders/GLTFLoader.js' {
  export class GLTFLoader { loadAsync(url:string):Promise<{scene:import('three').Group}> }
}
declare module '*garden-navigation.js' {
  export function createGardenNavigation(options:unknown):Promise<{snapshot():unknown;dispose():void;[key:string]:unknown}>
}
