import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js'
import '@ui5/webcomponents-icons/dist/AllIcons.js'
import './index.css'
import App from './App'

setTheme('sap_horizon')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
