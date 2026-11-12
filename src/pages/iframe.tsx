import "../index.css";
import { createRoot } from 'react-dom/client';
import React from "react";
import ErrorBoundary from '@/components/ErrorBoundary';
import { AccessibleMotionProvider } from '@/components/app-shell/AccessibleMotionProvider';
import IframePage from "./IframePage";
import { registerExtensionNoiseFilters } from "@/utils/registerExtensionNoiseFilters";

registerExtensionNoiseFilters();

const container = document.getElementById('root')!;
createRoot(container).render(
    <ErrorBoundary>
        <AccessibleMotionProvider>
            <IframePage />
        </AccessibleMotionProvider>
    </ErrorBoundary>
);
