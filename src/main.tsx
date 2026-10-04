import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/editorial.css'
import './styles/site-system.css'
import './styles/homepage.css'
import './lib/gsap'

// Service worker removed to fix loading issues

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
