import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import BrandPreloader from './components/BrandPreloader'
import './index.css'
import './styles/editorial.css'
import './styles/site-system.css'
import './styles/homepage.css'
import './styles/interaction.css'

// Service worker removed to fix loading issues

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <BrandPreloader />
  </React.StrictMode>,
)
