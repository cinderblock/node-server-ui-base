import React from 'react';
import ReactDOM from 'react-dom';

import { MainContainer } from './components/MainContainer';

import './style.css';

ReactDOM.render(<MainContainer />, document.body.appendChild(document.createElement('div')));

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
