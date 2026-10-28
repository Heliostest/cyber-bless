import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicScenePage } from '@wbr/app/public-scene';
import '@wbr/app/style.css';
import '@wbr/app/public-scene.css';

createRoot(document.getElementById('root')!).render(<StrictMode><PublicScenePage/></StrictMode>);
