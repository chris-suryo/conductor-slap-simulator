import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import App from '@/app/App'
import '@/index.css'
// Importing the theme store initializes the theme (applyTheme runs on store creation),
// reconciling the document + 3D scene singleton with the saved preference.
import '@/state/useThemeStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
