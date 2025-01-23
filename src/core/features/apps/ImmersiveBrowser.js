import WindowManager from "../../core/WindowManager.js"


class ImmersiveBrowser {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.isBlockingEnabled = true;
        this.blockCount = 0;
        // this.blocker = null;
        this.initializeAdBlocker();
    }

    async getAdBlocker() {
        const { ElectronBlocker } = await import('@ghostery/adblocker-electron');
        const fetch = (await import('cross-fetch')).default;
        const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch);
        return blocker;
    }

    async initializeAdBlocker() {
        try {
            const { ElectronBlocker } = await import('@ghostery/adblocker-electron');
            const fetch = (await import('cross-fetch')).default;
            this.blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch);
        } catch (error) {
            console.error('Failed to initialize ad blocker:', error);
            this.isBlockingEnabled = false;
        }
    }

    async promptForUrl() {
        // Wait for sl-dialog to be defined
        await customElements.whenDefined('sl-dialog');

        return new Promise((resolve) => {
            const dialog = Object.assign(document.createElement('sl-dialog'), {
                label: 'Enter URL',
                className: 'url-prompt-dialog'
            });

            dialog.innerHTML = `
                <div class="url-prompt-form">
                    <sl-input 
                        name="url" 
                        label="URL" 
                        placeholder="https://example.com" 
                        type="url"
                        autofocus
                    ></sl-input>
                </div>
                <div slot="footer">
                    <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
                    <sl-button variant="primary" class="submit-btn">Go</sl-button>
                </div>
            `;

            document.body.appendChild(dialog);

            const urlInput = dialog.querySelector('[name="url"]');
            const submitBtn = dialog.querySelector('.submit-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');

            const cleanup = () => {
                dialog.hide();
                setTimeout(() => dialog.remove(), 300);
            };

            submitBtn.addEventListener('click', () => {
                let url = urlInput.value.trim();
                if (url) {
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
                    cleanup();
                    resolve(url);
                }
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve('https://start.duckduckgo.com');
            });

            dialog.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    submitBtn.click();
                }
            });

            dialog.show();
        });
    }

    
    async createBrowserWindow() {
        const url = await this.promptForUrl();
        const windowId = await this.windowManager.createWindow({
            title: 'Loading...',
            content: this.createBrowserHTML(),
            immersive: true,
            controls: WindowManager.MacLike
        });

        const windowEl = document.getElementById(windowId);
        const webview = windowEl.querySelector('webview');

        webview.setAttribute('nodeintegration', 'false');
        webview.setAttribute('webpreferences', 'contextIsolation=yes');
        webview.setAttribute('allowpopups', 'true');

        webview.addEventListener('dom-ready', () => {
            if (this.isBlockingEnabled && this.blocker) {
                this.blocker.enableBlockingInWebView(webview);
            }
        });

        webview.addEventListener('did-start-loading', () => {
            webview.style.opacity = '0';
            
            // Add 3 second timeout
            setTimeout(() => {
                if (webview.style.opacity === '0') {
                    webview.style.opacity = '1';
                    const title = webview.getTitle() || url;
                    this.windowManager.updateWindowTitle(windowId, title);
                }
            }, 3000);
        });
    
        webview.addEventListener('did-finish-load', () => {
            webview.style.opacity = '1';
            const title = webview.getTitle();
            this.windowManager.updateWindowTitle(windowId, title);
        });

        webview.addEventListener('page-favicon-updated', (event) => {
            const favicon = event.favicons[0];
            if (favicon) {
                this.windowManager.updateWindowIcon(windowId, favicon);
            }
        });

        webview.src = url;
        return windowId;
    }
    
    createBrowserHTML() {
        return `
            <style>
                .immersive-window-content {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .immersive-window-content webview {
                    width: 100%;
                    height: 100%;
                    border: none;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .window.immersive .immersive-header {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    opacity: 0;
                    background: var(--sl-color-neutral-0);
                    transition: opacity 0.2s ease;
                    z-index: 1000;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 8px;
                }
                .window.immersive .immersive-header:hover {
                    opacity: 1;
                }
                .window.immersive .immersive-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .window.immersive .immersive-controls {
                    display: flex;
                    gap: 4px;
                }
            </style>
            <div class="immersive-window-content">
                <webview></webview>
            </div>
        `;
    }


        async launchUrl(url, name = '') {
        const windowId = await this.windowManager.createWindow({
            title: name || 'Loading...',
            content: this.createBrowserHTML(),
            immersive: true,
            icon: 'public',
            controls: WindowManager.MacLike
        });
    
        // Get window element reference after creation
        const windowEl = document.getElementById(windowId);
        if (!windowEl) {
            console.error('Failed to get window element');
            return windowId;
        }
    
        try {
            const savedStates = await window.electronAPI.store.get('windowStates') || {};
            const savedState = Object.values(savedStates).find(
                state => state.type === 'immersive' && state.url === url
            );
    
            if (savedState) {
                windowEl.style.left = `${savedState.position.x}px`;
                windowEl.style.top = `${savedState.position.y}px`;
                windowEl.style.width = `${savedState.size.width}px`;
                windowEl.style.height = `${savedState.size.height}px`;
            }
    
            const webview = windowEl.querySelector('webview');
            if (!webview) {
                throw new Error('Webview not found');
            }
    
            // Setup webview events
            webview.addEventListener('dom-ready', () => {
                if (this.isBlockingEnabled && this.blocker) {
                    this.blocker.enableBlockingInWebView(webview);
                }
            });
    
            webview.addEventListener('did-start-loading', () => {
                webview.style.opacity = '0';
                setTimeout(() => {
                    if (webview.style.opacity === '0') {
                        webview.style.opacity = '1';
                        const title = webview.getTitle() || url;
                        this.windowManager.updateWindowTitle(windowId, title);
                    }
                }, 3000);
            });
    
            webview.addEventListener('did-finish-load', () => {
                webview.style.opacity = '1';
                const title = webview.getTitle();
                this.windowManager.updateWindowTitle(windowId, title);
            });
    
            webview.src = url;
            return windowId;
    
        } catch (error) {
            console.error('Error in launchUrl:', error);
            throw error;
        }
    }
}

export default ImmersiveBrowser;