import WindowManager from "./WindowManager.js";


// WebAppViewer.js
class WebAppViewer {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.activeApps = new Map();
    }

    async createWebAppWindow(appInfo) {
        const content = this.createViewerHTML();
        const windowId = await this.windowManager.createWindow({
            title: appInfo.name || 'Web App',
            content: content,
            isWidget: false,
            controls: WindowManager.MacLike,
            className: 'web-app-container',
            width: appInfo.settings?.size?.width || 800,
            height: appInfo.settings?.size?.height || 600,
            // Add custom header content with reload button
            headerContent: `
                <img src="${appInfo.favicon}" style="width: 16px; height: 16px; vertical-align: middle;" onerror="this.replaceWith(document.createElement('span')).className='material-symbols-outlined'; this.textContent='public'">
                <sl-button class="reload-button" variant="text" size="small" title="Reload page">
                    <span class="material-symbols-outlined">refresh</span>
                </sl-button>
            `
        });
    
        // Add event listener for reload button after window is created
        const window = document.getElementById(windowId);
        const reloadButton = window.querySelector('.reload-button');
        const webview = window.querySelector('webview');
        
        if (reloadButton && webview) {
            reloadButton.addEventListener('click', () => {
                webview.reload();
            });
        }
    
        await this.loadWebContent(windowId, appInfo.url);
        this.activeApps.set(windowId, { info: appInfo });
        return windowId;
    }

    createViewerHTML() {
        return `
            <div class="web-app-viewer">
                <div class="viewer-wrapper">
                    <webview 
                        class="viewer-frame" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        allowpopups
                        webpreferences="contextIsolation=yes"
                    ></webview>
                    <div class="web-app-loading" style="opacity: 0; pointer-events: none;">
                        <sl-spinner></sl-spinner>
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadWebContent(windowId, url) {
        const container = document.getElementById(windowId);
        if (!container) return;
    
        const webview = container.querySelector('webview');
        const loading = container.querySelector('.web-app-loading');
        
        // Set up loading timeout
        let loadTimeout;
        
        const showLoading = () => {
            loading.style.opacity = '1';
            loading.style.pointerEvents = 'auto';
            // Set timeout to hide loading after 10 seconds .. changed to 4 seconds
            loadTimeout = setTimeout(() => hideLoading(), 4000);
        };
    
        const hideLoading = () => {
            loading.style.opacity = '0';
            loading.style.pointerEvents = 'none';
            if (loadTimeout) {
                clearTimeout(loadTimeout);
                loadTimeout = null;
            }
        };
    
        try {
            webview.src = url;
    
            webview.addEventListener('did-start-loading', () => {
                showLoading();
            });
    
            webview.addEventListener('did-finish-load', () => {
                hideLoading();
                this.updateFavicon(windowId, webview);
            });
    
            webview.addEventListener('did-fail-load', (error) => {
                hideLoading();
                console.error('Failed to load web app:', error);
                // Optionally show error message to user
            });
    
            // Clean up on window close
            return () => {
                if (loadTimeout) {
                    clearTimeout(loadTimeout);
                }
            };
        } catch (error) {
            hideLoading();
            console.error('Error loading web content:', error);
        }
    }

    async updateFavicon(windowId, webview) {
        try {
            // Get favicon from the page
            const favicon = await webview.executeJavaScript(`
                (function() {
                    const link = document.querySelector("link[rel~='icon']");
                    if (link) return link.href;
                    return null;
                })()
            `);

            if (favicon) {
                const window = document.getElementById(windowId);
                const titlebar = window.querySelector('.window-title');
                const existingIcon = titlebar.querySelector('.material-symbols-outlined');
                
                if (existingIcon) {
                    // Replace material icon with favicon
                    const img = document.createElement('img');
                    img.src = favicon;
                    img.style.width = '20px';
                    img.style.height = '20px';
                    existingIcon.replaceWith(img);
                }
            }
        } catch (error) {
            console.error('Error updating favicon:', error);
        }
    }

    closeApp(windowId) {
        this.activeApps.delete(windowId);
    }
}

export default WebAppViewer;