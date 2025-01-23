import WindowManager from "../../core/WindowManager.js"


class HTMLViewer {
    constructor(windowManager) {
        this.windowManager = windowManager;
    }

    async createWindow() {
        const windowId = await this.windowManager.createWindow({
            title: 'HTML Viewer',
            content: this.createViewerHTML(),
            isWidget: false,
            controls: WindowManager.WinLike
        });

        this.setupFileHandling(windowId);
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
                <div class="viewer-content">
                    <!-- Content will be loaded here -->
                </div>
            </div>
        `;
    }

    // async setupFileHandling(windowId) {
    //     const container = document.getElementById(windowId);
    //     if (!container) return;
    
    //     const loadButton = container.querySelector('.load-file-btn');
    //     const contentArea = container.querySelector('.viewer-content');
    
    //     loadButton.addEventListener('click', async () => {
    //         try {
    //             // Using openFile that exists in your API
    //             const filePath = await window.electronAPI.openFile({
    //                 filters: [
    //                     { name: 'HTML Files', extensions: ['html', 'htm'] }
    //                 ]
    //             });
    
    //             if (filePath) {
    //                 console.log('Selected file:', filePath);
    //                 // Using readFile that exists in your API
    //                 const content = await window.electronAPI.readFile(filePath);
    //                 contentArea.innerHTML = content;
    //             }
    //         } catch (error) {
    //             console.error('Error in file handling:', error);
    //         }
    //     });
    // }

    async setupFileHandling(windowId) {
        const container = document.getElementById(windowId);
        if (!container) return;
    
        console.log('Setting up file handling for window:', windowId);
    
        const loadButton = container.querySelector('.load-file-btn');
        const contentArea = container.querySelector('.viewer-content');
    
        loadButton.addEventListener('click', async () => {
            try {
                console.log('Load button clicked');
                
                // First wait for the file selection
                const filePath = await window.electronAPI.openFile({
                    filters: [
                        { name: 'HTML Files', extensions: ['html', 'htm'] }
                    ]
                });
    
                console.log('Selected file path:', filePath);
    
                if (filePath) {
                    // Explicitly wait for the read operation
                    const content = await window.electronAPI.readFile(filePath);
                    console.log('File content loaded, length:', content?.length);
                    
                    if (content) {
                        contentArea.innerHTML = content;
                    } else {
                        console.error('No content returned from readFile');
                    }
                }
            } catch (error) {
                console.error('Error in file handling:', error);
                if (error.stack) {
                    console.error('Error stack:', error.stack);
                }
            }
        });
    }
}

export default HTMLViewer;