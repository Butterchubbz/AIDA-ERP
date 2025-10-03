// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client'; // Use ReactDOM.createRoot for React 18+
import { BrowserRouter } from 'react-router-dom';
import App from './App'; // The main application component
import { AuthProvider } from './context/AuthContext'; // Provides authentication context
import { InventoryProvider } from './context/InventoryContext'; // Provides inventory data context
import { MessageBoxProvider } from './components/MessageBox'; // Provides custom message box functionality
import './index.css'; // Import global styles (including Tailwind CSS)

// Get the root element from public/index.html where the React app will be mounted
const rootElement = document.getElementById('root');

// Create a React root, which is the recommended way to render in React 18
const root = ReactDOM.createRoot(rootElement);

// Render the application
root.render(
  // React.StrictMode helps in highlighting potential problems in an application.
  // It activates additional checks and warnings for its descendants.
  <React.StrictMode>
    <BrowserRouter>
      <MessageBoxProvider>
        <AuthProvider>
          <InventoryProvider>
            <App />
          </InventoryProvider>
        </AuthProvider>
      </MessageBoxProvider>
    </BrowserRouter>
  </React.StrictMode>
);
