import WindowManager from "../../core/WindowManager.js"

class HTMLViewer {
    constructor(windowManager) {
        this.windowManager = windowManager;
    }

    async createWindow() {
        const content = this.createViewerHTML();
        const windowId = await this.windowManager.createWindow({
            title: 'HTML Viewer',
            content: content,
            isWidget: false,
            controls: WindowManager.MacLike,
            className: 'new-html-container'
        });

        await this.setupFileHandling(windowId);
        return windowId;
    }

    createViewerHTML() {
        return `
            <div class="html-viewer">
                <div class="viewer-toolbar">
                    <sl-button class="load-file-btn">
                        <sl-icon slot="prefix" name="folder"></sl-icon>
                        Load HTML File
                    </sl-button>
                </div>
                <div class="viewer-wrapper">
                    <iframe 
                        class="viewer-frame" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    ></iframe>
                </div>
            </div>
        `;
    }

    async setupFileHandling(windowId) {
        const container = document.getElementById(windowId);
        if (!container) return;

        const loadButton = container.querySelector('.load-file-btn');
        const iframe = container.querySelector('.viewer-frame');

        loadButton.addEventListener('click', async () => {
            try {
                const filePath = await window.electronAPI.openFile({
                    filters: [
                        { name: 'HTML Files', extensions: ['html', 'htm'] }
                    ]
                });

                if (filePath) {
                    const content = await window.electronAPI.readFile(filePath);
                    const blob = new Blob([content], { 
                        type: 'text/html;charset=utf-8' 
                    });
                    const blobURL = URL.createObjectURL(blob);
                    
                    iframe.src = blobURL;
                    iframe.onload = () => URL.revokeObjectURL(blobURL);
                }
            } catch (error) {
                console.error('Error loading HTML:', error);
            }
        });
    }
}

export default HTMLViewer;