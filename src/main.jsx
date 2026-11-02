import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ResumeProvider } from './state/ResumeContext.jsx'
import './styles/global.css'
import './styles/templates.css'
import './styles/markdown.css'
import './styles/print.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ResumeProvider>
      <App />
    </ResumeProvider>
  </React.StrictMode>
)
