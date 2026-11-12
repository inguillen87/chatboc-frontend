import React from 'react';
import { createRoot } from 'react-dom/client';
import EvaluationApp from './EvaluationApp';

const root = document.getElementById('evaluation-root');
if (!root) throw new Error('evaluation_root_missing');
createRoot(root).render(<EvaluationApp />);
