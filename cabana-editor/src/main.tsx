import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './style.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz do laboratório não encontrado.')
createRoot(root).render(<StrictMode><App /></StrictMode>)
