//features/apps/TorrentViewer.js
import WindowManager from "../../core/WindowManager.js"

class TorrentViewer {
    constructor(windowManager) {
        this.windowManager = windowManager;
        // Use global WebTorrent from browser bundle
        this.client = new WebTorrent();
        this.currentTorrent = null;
        this.downloadPath = null;
    }

    async createWindow() {
        const content = `
            <div class="torrent-viewer">
                <div class="input-area">
                    <sl-input class="magnet-input" placeholder="Paste magnet link or select torrent file"></sl-input>
                    <sl-button class="load-btn">Load</sl-button>
                    <sl-button class="select-file-btn">Select Torrent File</sl-button>
                </div>
                <div class="file-list"></div>
                <div class="video-player-container"></div>
            </div>
        `;

        const windowId = await this.windowManager.createWindow({
            title: 'Torrent Viewer',
            content,
            width: 800,
            height: 600,
            controls: WindowManager.MacLike,
            isWidget: false,
            icon: 'movie'
        });

        this.setupEventListeners(windowId);
        return windowId;
    }

    async setupEventListeners(windowId) {
        const window = document.getElementById(windowId);
        const loadBtn = window.querySelector('.load-btn');
        const selectFileBtn = window.querySelector('.select-file-btn');
        const magnetInput = window.querySelector('.magnet-input');

        loadBtn.addEventListener('click', () => {
            const magnetLink = magnetInput.value.trim();
            if (magnetLink) this.loadTorrent(magnetLink, windowId);
        });

        selectFileBtn.addEventListener('click', async () => {
            const file = await window.electronAPI.openFile({
                filters: [{ name: 'Torrent Files', extensions: ['torrent'] }]
            });
            if (file) this.loadTorrent(file, windowId);
        });
    }

    async loadTorrent(source, windowId) {
        if (this.currentTorrent) {
            await this.cleanup();
        }

        this.client.add(source, { path: this.downloadPath }, (torrent) => {
            this.currentTorrent = torrent;
            this.displayFiles(windowId, torrent.files);
        });
    }

    displayFiles(windowId, files) {
        const window = document.getElementById(windowId);
        const fileList = window.querySelector('.file-list');
        fileList.innerHTML = '';

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            if (file.name.endsWith('.mp4')) {
                fileItem.innerHTML = `
                    <span>${file.name}</span>
                    <sl-button size="small" class="stream-btn">Stream</sl-button>
                `;
                
                fileItem.querySelector('.stream-btn').addEventListener('click', () => {
                    this.streamFile(file, windowId);
                });
            } else {
                fileItem.textContent = file.name;
            }
            
            fileList.appendChild(fileItem);
        });
    }

    streamFile(file, windowId) {
        const window = document.getElementById(windowId);
        const playerContainer = window.querySelector('.video-player-container');
        
        const videoElement = document.createElement('video');
        videoElement.controls = true;
        videoElement.style.width = '100%';
        
        file.streamTo(videoElement);
        
        playerContainer.innerHTML = '';
        playerContainer.appendChild(videoElement);
    }

    async cleanup() {
        if (this.currentTorrent) {
            return new Promise((resolve) => {
                this.currentTorrent.destroy(() => {
                    this.currentTorrent = null;
                    resolve();
                });
            });
        }
    }
}

export default TorrentViewer;