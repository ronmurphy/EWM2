import WindowManager from "../../core/WindowManager.js";

class VideoPlayer {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.activeWindows = new Map();
        this.addVideoJSDependencies();
    }

    addVideoJSDependencies() {
        // Add CSS
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://vjs.zencdn.net/8.6.1/video-js.css';
        document.head.appendChild(cssLink);
    
        // Add theme CSS
        const themeCssLink = document.createElement('link');
        themeCssLink.rel = 'stylesheet';
        themeCssLink.href = 'https://unpkg.com/@videojs/themes@1.0.1/dist/fantasy/index.css';
        document.head.appendChild(themeCssLink);
    
        // Add JS
        const scriptTag = document.createElement('script');
        scriptTag.src = 'https://vjs.zencdn.net/8.6.1/video.min.js';
        document.head.appendChild(scriptTag);
    }

    async createWindow() {
        const windowId = await this.windowManager.createWindow({
            title: 'Video Player',
            content: this.createPlayerHTML(),
            isWidget: false,
            controls: WindowManager.MacLike
        });

        await this.waitForVideoJS();
        this.initializePlayer(windowId);
        return windowId;
    }

    waitForVideoJS() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.videojs) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }


    createPlayerHTML() {
        const playerId = `videoPlayer-${Date.now()}`;
        return `
            <div class="video-player">
                <!-- Initial file selection modal - using only display/visibility -->
                <div class="initial-file-overlay">
                    <div class="file-selection-modal">
                        <h2>Select Video</h2>
                        <sl-button variant="primary" size="large" class="select-file-btn">
                            <sl-icon name="folder" slot="prefix"></sl-icon>
                            Open Video File
                        </sl-button>
                        <p class="drag-hint">or drag and drop a video file here</p>
                    </div>
                </div>
    
                <div class="video-drop-zone">
                    <div class="player-container" id="container-${playerId}">
                        <video id="${playerId}" class="video-js vjs-theme-fantasy" controls preload="auto">
                            <p class="vjs-no-js">
                                To view this video please enable JavaScript
                            </p>
                        </video>
                    </div>
                    
                    <!-- Pause state overlay -->
                    <div class="pause-overlay">
                        <div class="pause-modal">
                            <sl-button-group vertical>
                                <sl-button size="large" class="resume-btn">
                                    <sl-icon name="play-fill" slot="prefix"></sl-icon>
                                    Resume Video
                                </sl-button>
                                <sl-button size="large" class="change-video-btn">
                                    <sl-icon name="folder" slot="prefix"></sl-icon>
                                    Change Video
                                </sl-button>
                            </sl-button-group>
                        </div>
                    </div>
    
                    <!-- Drop overlay -->
                    <div class="drop-overlay">
                        <sl-icon name="cloud-upload"></sl-icon>
                        <span>Drop video file here</span>
                    </div>
                </div>
                <input type="file" class="file-input" accept="video/*" style="display: none">
            </div>
        `;
    }

    initializePlayer(windowId) {
        const container = document.getElementById(windowId);
        if (!container) {
            console.error('Container not found');
            return;
        }
    
        console.log('Initializing player for window:', windowId);
    
        // Get all required elements
        const elements = {
            player: container.querySelector('.video-player'),
            container: container.querySelector('.video-drop-zone'),
            video: container.querySelector('video'),
            dropZone: container.querySelector('.video-drop-zone'),
            dropOverlay: container.querySelector('.drop-overlay'),
            initialOverlay: container.querySelector('.initial-file-overlay'),
            fileInput: container.querySelector('.file-input'),
            selectFileBtn: container.querySelector('.select-file-btn')
        };
    
        // Debug log what we found
        console.log('Found elements:', {
            ...Object.entries(elements).reduce((acc, [key, value]) => ({
                ...acc,
                [key]: !!value
            }), {})
        });
    
        // Verify we have all required elements
        const missingElements = Object.entries(elements)
            .filter(([_, element]) => !element)
            .map(([name]) => name);
    
        if (missingElements.length > 0) {
            console.error('Missing required elements:', missingElements);
            return;
        }
    
        // Initialize Video.js with specific dimensions
        const player = window.videojs(elements.video, {
            fluid: true,
            fill: true
        });
    
        // Store reference to video.js player
        elements.vjsPlayer = player;
    
        // Set up pause/play handlers
        player.on('pause', () => {
            elements.dropOverlay?.classList?.add('visible');
        });
    
        player.on('play', () => {
            elements.dropOverlay?.classList?.remove('visible');
        });
    
        // Handle resume button
        const resumeBtn = container.querySelector('.resume-btn');
        resumeBtn?.addEventListener('click', () => {
            player.play();
        });
    
        // Handle change video button
        const changeVideoBtn = container.querySelector('.change-video-btn');
        changeVideoBtn?.addEventListener('click', () => {
            elements.fileInput?.click();
        });
    
        // Set up file input and selection
        if (elements.fileInput && elements.selectFileBtn) {
            this.setupFileSelection(elements);
        }
    
        // Set up drag and drop if we have the required elements
        if (elements.dropZone && elements.dropOverlay) {
            this.setupDragAndDrop(elements);
        }
    
        // Store reference to all elements
        this.activeWindows.set(windowId, elements);
    
        return elements;
    }

    setupDragAndDrop(elements) {
        const { dropZone, dropOverlay } = elements;

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                this.loadVideo(elements, file);
            }
        });
    }

    setupFileSelection(elements) {
        const { fileInput, selectFileBtn } = elements;
        
        if (!fileInput || !selectFileBtn) {
            console.error('Missing required elements for file selection');
            return;
        }
    
        // Set up select button click handler
        selectFileBtn.addEventListener('click', () => {
            console.log('Select button clicked');
            fileInput.click();
        });
    
        // Set up file input change handler
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                console.log('File selected:', file.name);
                this.loadVideo(elements, file);
            }
        });
    }

    loadVideo(elements, file) {
        console.log('Loading video:', file.name);
        const { vjsPlayer, container } = elements;
        const url = URL.createObjectURL(file);
    
        if (this.currentVideoUrl) {
            URL.revokeObjectURL(this.currentVideoUrl);
        }
    
        vjsPlayer.src({ type: file.type, src: url });
        this.currentVideoUrl = url;
    
        // Hide the initial overlay
        const initialOverlay = container.querySelector('.initial-file-overlay');
        if (initialOverlay) {
            initialOverlay.classList.add('hidden');
            console.log('Initial overlay hidden');
        }
    
        // Hide drop overlay if it's visible
        const dropOverlay = container.querySelector('.drop-overlay');
        if (dropOverlay) {
            dropOverlay.classList.remove('visible');
        }
    
        // Start playing the video
        vjsPlayer.play().catch(err => {
            console.warn('Auto-play failed:', err);
        });
    }

    cleanup(windowId) {
        const elements = this.activeWindows.get(windowId);
        if (elements) {
            if (this.currentVideoUrl) {
                URL.revokeObjectURL(this.currentVideoUrl);
            }
            if (elements.vjsPlayer) {
                elements.vjsPlayer.dispose();
            }
        }
        this.activeWindows.delete(windowId);
    }
}

export default VideoPlayer;