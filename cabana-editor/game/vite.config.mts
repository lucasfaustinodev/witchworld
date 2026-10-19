import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({envDir:false,build:{outDir:'../dist',emptyOutDir:false,target:'es2022',minify:false,
  lib:{entry:fileURLToPath(new URL('./cabin-interior.ts',import.meta.url)),formats:['es'],fileName:()=> 'cabin-interior.js'},
  rolldownOptions:{external:(id)=>id==='three'||id.includes('/dist/vendor/')||id.endsWith('/dist/garden-navigation.js')||id.startsWith('../dist/'),
    output:{paths:(id)=>id==='three'?'./vendor/three.module.js':id.includes('GLTFLoader')?'./vendor/addons/loaders/GLTFLoader.js':id.includes('garden-navigation')?'./garden-navigation.js':id}}
}})
