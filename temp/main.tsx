import React from 'react';
import { createRoot } from 'react-dom/client';
import LongMarch from '../src/features/longmarch/LongMarch';

createRoot(document.getElementById('root')!).render(<React.StrictMode><LongMarch /></React.StrictMode>);
