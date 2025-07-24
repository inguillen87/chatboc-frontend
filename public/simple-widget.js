(function() {
    'use strict';

    // CSS styles for the widget
    const styles = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .chatboc-widget-launcher {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: #2563eb;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1), 0 6px 6px rgba(0,0,0,0.15);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 2147483647;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .chatboc-widget-launcher:hover {
            transform: scale(1.1);
        }

        .chatboc-widget-launcher svg {
            width: 32px;
            height: 32px;
            color: white;
        }

        .chatboc-widget-panel {
            position: fixed;
            bottom: 100px;
            right: 20px;
            width: 400px;
            height: 600px;
            border-radius: 16px;
            background-color: #ffffff;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            display: none;
            flex-direction: column;
            animation: fadeIn 0.3s ease forwards;
            z-index: 2147483647;
        }

        .chatboc-widget-panel.open {
            display: flex;
        }

        @media (max-width: 480px) {
            .chatboc-widget-panel {
                width: calc(100vw - 40px);
                height: calc(100vh - 120px);
                bottom: 100px;
                right: 20px;
            }
        }

        .chatboc-widget-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            background-color: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
        }

        .chatboc-widget-header h2 {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
        }

        .chatboc-widget-header button {
            background: none;
            border: none;
            cursor: pointer;
            color: #6b7280;
            transition: color 0.2s ease;
        }

        .chatboc-widget-body {
            flex-grow: 1;
            padding: 16px;
            overflow-y: auto;
        }

        .chatboc-widget-footer {
            padding: 16px;
            border-top: 1px solid #e5e7eb;
        }

        .chatboc-widget-footer input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
        }

        .widget-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background-color: #fff;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
        }

        .widget-error img {
            width: 80px;
            height: 80px;
            margin-bottom: 20px;
        }

        .widget-error p {
            font-size: 16px;
            color: #6b7280;
        }
    `;

    // Create a style element and add the CSS styles to the head
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    document.head.appendChild(styleEl);

    // Create the widget launcher
    const launcher = document.createElement('div');
    launcher.className = 'chatboc-widget-launcher';
    launcher.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
    `;
    document.body.appendChild(launcher);

    // Create the widget panel
    const panel = document.createElement('div');
    panel.className = 'chatboc-widget-panel';
    document.body.appendChild(panel);

    // Function to render the widget content
    function renderPanelContent(error = false) {
        if (error) {
            panel.innerHTML = `
                <div class="widget-error">
                    <img src="https://www.chatboc.ar/logo.png" alt="Chatboc" />
                    <p>No se pudo cargar el chat.<br />Intentá recargar o contactá soporte.</p>
                </div>
            `;
        } else {
            panel.innerHTML = `
                <div class="chatboc-widget-header">
                    <h2>Chatboc</h2>
                    <button class="chatboc-close-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="chatboc-widget-body">
                    <!-- Chat messages will go here -->
                </div>
                <div class="chatboc-widget-footer">
                    <input type="text" placeholder="Escribe un mensaje...">
                </div>
            `;
        }
    }

    // Toggle the widget panel
    function togglePanel() {
        panel.classList.toggle('open');
    }

    // Event listeners
    launcher.addEventListener('click', togglePanel);
    panel.addEventListener('click', function(e) {
        if (e.target.classList.contains('chatboc-close-button') || e.target.closest('.chatboc-close-button')) {
            togglePanel();
        }
    });

    const script = document.currentScript;
    const token = script.getAttribute('data-token');
    const endpoint = script.getAttribute('data-endpoint');

    // Function to render the widget content
    function renderPanelContent(error = false) {
        if (error || !token) {
            panel.innerHTML = `
                <div class="widget-error">
                    <img src="https://www.chatboc.ar/logo.png" alt="Chatboc" />
                    <p>No se pudo cargar el chat.<br />Intentá recargar o contactá soporte.</p>
                </div>
            `;
        } else {
            panel.innerHTML = `
                <div class="chatboc-widget-header">
                    <h2>Chatboc</h2>
                    <button class="chatboc-close-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="chatboc-widget-body">
                    <p>Token: ${token}</p>
                    <p>Endpoint: ${endpoint}</p>
                </div>
                <div class="chatboc-widget-footer">
                    <input type="text" placeholder="Escribe un mensaje...">
                </div>
            `;
        }
    }

    // Toggle the widget panel
    function togglePanel() {
        panel.classList.toggle('open');
    }

    // Event listeners
    launcher.addEventListener('click', togglePanel);
    panel.addEventListener('click', function(e) {
        if (e.target.classList.contains('chatboc-close-button') || e.target.closest('.chatboc-close-button')) {
            togglePanel();
        }
    });

    renderPanelContent();
})();
