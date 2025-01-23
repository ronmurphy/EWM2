import WindowManager from "./WindowManager.js";


// ModuleViewer.js
class ModuleViewer {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.activeModules = new Map();
    }


    async createModuleWindow(moduleInfo, folderName) {
        const content = this.createViewerHTML();
        const windowId = await this.windowManager.createWindow({
            title: moduleInfo.name,
            content: content,
            isWidget: false,
            controls: WindowManager.MacLike,
            className: 'module-viewer-container',
            width: moduleInfo.settings?.size?.width || 400,
            height: moduleInfo.settings?.size?.height || 300,
            icon: `<span class="material-symbols-outlined">${moduleInfo.icon || 'widgets'}</span>` // Add icon here
        });
    
        await this.loadModuleContent(windowId, folderName);
        this.activeModules.set(windowId, { info: moduleInfo, folder: folderName });
        return windowId;
    }

    createViewerHTML() {
        return `
            <div class="module-viewer">
                <div class="viewer-wrapper">
                    <iframe 
                        class="viewer-frame" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    ></iframe>
                </div>
            </div>
        `;
    }

    async loadModuleContent(windowId, folderName) {
        const container = document.getElementById(windowId);
        if (!container) return;
    
        const iframe = container.querySelector('.viewer-frame');
        try {
            // Use correct path relative to src
            const modulePath = `features/modules/${folderName}/index.html`;
            console.log('Loading module from:', modulePath);
            const content = await window.electronAPI.readFile(modulePath);
            const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
            const blobURL = URL.createObjectURL(blob);
            
            iframe.src = blobURL;
            iframe.onload = () => URL.revokeObjectURL(blobURL);
        } catch (error) {
            console.error('Error loading module:', error);
        }
    }

    setupModuleCommunication(windowId, iframe) {
        // Optional: Add message handling between module and main app
        window.addEventListener('message', (event) => {
            if (event.source === iframe.contentWindow) {
                this.handleModuleMessage(windowId, event.data);
            }
        });
    }

    handleModuleMessage(windowId, message) {
        // Handle module-specific messages
        console.log(`Module ${windowId} message:`, message);
    }

    closeModule(windowId) {
        this.activeModules.delete(windowId);
    }
}

export default ModuleViewer;