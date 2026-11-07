import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MainContainer } from './components/MainContainer';

import './style.css';

createRoot(document.body.appendChild(document.createElement('div'))).render(
  <StrictMode>
    <MainContainer />
  </StrictMode>,
);

document.addEventListener(
  'keydown',
  event => {
    if (event.code == 'F12') {
      // Open developer console
      return;
    }

    console.log('No handler for:', event);
  },
  false,
);
