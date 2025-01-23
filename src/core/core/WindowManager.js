class WindowManager {

// Define default control templates
// shoelace
static Shoelace = `
<sl-button size="small" class="minimize" variant="text">
    <sl-icon name="dash-square"></sl-icon>
</sl-button>
<sl-button size="small" class="maximize" variant="text">
    <sl-icon name="plus-square"></sl-icon>
</sl-button>
<sl-button size="small" class="close" variant="text">
    <sl-icon name="x-square"></sl-icon>
</sl-button>
`;

// alt windows like
static WinLike = `
<sl-button size="small" class="minimize" variant="text">
    <span class="material-symbols-outlined"> minimize </span>
</sl-button>
<sl-button size="small" class="maximize" variant="text">
    <span class="material-symbols-outlined"> open_in_full </span>
</sl-button>
<sl-button size="small" class="close" variant="text">
    <span class="material-symbols-outlined"> disabled_by_default </span>
</sl-button>
`;

// mac like
static MacLike = `
<sl-button size="small" class="minimize" variant="text">
    <span class="material-symbols-outlined">
    do_not_disturb_on
    </span>    
</sl-button>
<sl-button size="small" class="maximize" variant="text">
    <span class="material-symbols-outlined">
    add_circle
    </span>    
</sl-button>
<sl-button size="small" class="close" variant="text">
    <span class="material-symbols-outlined">
    cancel
    </span>    
</sl-button>
`

// FontAwesome
static FontAwesome = `
<sl-button size="small" class="minimize" variant="text">
<i class="fa-solid fa-compress"></i>
</sl-button>
<sl-button size="small" class="maximize" variant="text">
<i class="fa-solid fa-expand"></i>
</sl-button>
<sl-button size="small" class="close" variant="text">
<i class="fa-solid fa-xmark"></i>
</sl-button>
`;

static ImmersiveControls = `
<sl-button size="small" class="window-trigger" variant="text">
    <span class="window-icon material-symbols-outlined">window</span>
</sl-button>
<div class="window-controls-panel">
    <div class="window-controls">
        <sl-button size="small" class="minimize" variant="text">
            <span class="material-symbols-outlined">minimize</span>
        </sl-button>
        <sl-button size="small" class="maximize" variant="text">
            <span class="material-symbols-outlined">open_in_full</span>
        </sl-button>
        <sl-button size="small" class="close" variant="text">
            <span class="material-symbols-outlined">close</span>
        </sl-button>
    </div>
</div>
`;

    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 1000;
        this.events = new Map();
        this.dockManager = null;
        this.dockedWindows = new Map(); // Store docked window relationships
        this.isDockResizing = false;
        this.loadSavedWindows();
        this.loadSavedStates();
        this.setupWindowStateTracking();

        // Bind methods
        this.createWindow = this.createWindow.bind(this);
        this.handleWindowAction = this.handleWindowAction.bind(this);
        
        // Set up window template
        this.windowTemplate = document.getElementById('window-template');

        //memory management
        this.heavyDomains = ['facebook.com', 'messenger.com', 'bing.com'];
        this.memoryThreshold = 800; // MB
        this.eventListeners = new WeakMap();
        this.webviewPool = new Set();
        this.maxPoolSize = 5;
        this.setupCleanupInterval();
        this.setupMonitoring();
        this.activeWindow = null;
        this.inactiveTimeout = 5 * 60 * 1000; // 5 minutes
        this.setupInactiveWindowMonitor();
    }

    setupWindowStateTracking() {
        // Save states before app closes
        window.addEventListener('beforeunload', () => {
            this.saveAllWindowStates();
        });
    }

    setupInactiveWindowMonitor() {
        setInterval(() => {
            const now = Date.now();
            this.windows.forEach((window, id) => {
                if (window.lastActive && (now - window.lastActive) > this.inactiveTimeout) {
                    this.suspendInactiveWindow(id);
                }
            });
        }, 60000); // Check every minute
    }

    async saveAllWindowStates() {
        const states = {};
        this.windows.forEach((window, id) => {
            const webview = window.element.querySelector('webview');
            if (webview) {
                states[id] = {
                    position: {
                        x: window.element.offsetLeft,
                        y: window.element.offsetTop
                    },
                    size: {
                        width: window.element.offsetWidth,
                        height: window.element.offsetHeight
                    },
                    isMaximized: window.isMaximized,
                    type: window.element.classList.contains('immersive') ? 'immersive' : 'browser',
                    url: webview.src,
                    title: window.title
                };
            }
        });
        await window.electronAPI.store.set('windowStates', states);
    }

    setupMemoryMonitoring() {
        this.memoryInterval = setInterval(async () => {
            const memory = await window.electronAPI.getMemoryUsage();
            
            // Aggressive cleanup above threshold
            if (memory.total > this.memoryThreshold * 1024 * 1024) {
                this.aggressiveCleanup();
            }
        }, 30000);
    }

    aggressiveCleanup() {
        this.windows.forEach((window, id) => {
            const webview = window.element.querySelector('webview');
            if (!webview) return;

            const url = new URL(webview.getURL());
            const isHeavySite = this.heavyDomains.some(domain => 
                url.hostname.includes(domain)
            );

            if (isHeavySite && !window.isActive) {
                webview.setZoomFactor(0.1);
                webview.send('aggressive-throttle');
                if (typeof webview.purgeMemory === 'function') {
                    webview.purgeMemory();
                }
            }
        });

        // Force garbage collection
        if (window.gc) {
            window.gc();
        }
    }

    suspendInactiveWindow(windowId) {
        const window = this.windows.get(windowId);
        if (!window || window === this.activeWindow) return;

        const webview = window.element.querySelector('webview');
        if (webview) {
            webview.send('suspend-window');
            webview.setZoomFactor(0.1);
            window.suspended = true;
        }
    }

    activateWindow(windowId) {
        const window = this.windows.get(windowId);
        if (!window) return;

        if (this.activeWindow) {
            this.activeWindow.element.classList.remove('active');
        }

        window.lastActive = Date.now();
        window.suspended = false;
        this.activeWindow = window;
        window.element.classList.add('active');

        const webview = window.element.querySelector('webview');
        if (webview) {
            webview.setZoomFactor(1);
            webview.send('resume-window');
        }
    }

    setupCleanupInterval() {
        // Check for inactive windows every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanupInactiveWindows();
        }, 60000);
    }

    trackListener(element, type, listener) {
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, new Map());
        }
        const listeners = this.eventListeners.get(element);
        if (!listeners.has(type)) {
            listeners.set(type, new Set());
        }
        listeners.get(type).add(listener);
    }

    setupMonitoring() {
        this.memoryInterval = setInterval(async () => {
            const memory = await window.electronAPI.getMemoryUsage();
            if (memory.percentUsed > 80) {
                this.throttleBackgroundWindows();
            }
        }, 30000);
    }

    throttleBackgroundWindows() {
        this.windows.forEach((window, id) => {
            const webview = window.element.querySelector('webview');
            if (webview && !window.isActive) {
                webview.setZoomFactor(0.1); // Reduce quality
                webview.send('background-throttle');
            }
        });
    }

    setupBackgroundThrottling(webview) {
        webview.addEventListener('dom-ready', () => {
            try {
                const url = webview.src ? new URL(webview.src) : null;
                if (url && this.heavyDomains.some(domain => url.hostname.includes(domain))) {
                    webview.setZoomFactor(0.8);
                }
            } catch (error) {
                console.warn('Invalid URL in setupBackgroundThrottling:', error);
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                webview.setZoomFactor(0.1);
                webview.send('background-throttle');
            } else {
                webview.setZoomFactor(1);
                webview.send('resume-window');
            }
        });
    }
    
    saveWindowState(windowId) {
        const window = this.windows.get(windowId);
        if (!window) return;
    
        const state = {
            position: {
                x: window.element.offsetLeft,
                y: window.element.offsetTop
            },
            size: {
                width: window.element.offsetWidth,
                height: window.element.offsetHeight
            },
            isMaximized: window.isMaximized
        };
    
        localStorage.setItem(`window-state-${windowId}`, JSON.stringify(state));
    }

    saveWindowStates(states) {
        try {
            localStorage.setItem('windowStates', JSON.stringify(states));
            window.electronAPI.store.set('windowStates', states);
        } catch (error) {
            console.error('Failed to save window states:', error);
        }
    }

    saveAllWindowStates() {
        const states = {};
        this.windows.forEach((window, id) => {
            const webview = window.element.querySelector('webview');
            if (webview) {
                states[id] = {
                    position: {
                        x: window.element.offsetLeft,
                        y: window.element.offsetTop
                    },
                    size: {
                        width: window.element.offsetWidth,
                        height: window.element.offsetHeight
                    },
                    isMaximized: window.isMaximized,
                    type: window.element.classList.contains('immersive') ? 'immersive' : 'browser',
                    url: webview.src,
                    title: window.title
                };
            }
        });
        
        window.electronAPI.store.set('windowStates', states)
            .catch(error => {
                console.error('Failed to save window states:', error);
            });
    }

    async loadSavedStates() {
        try {
            const states = await window.electronAPI.store.get('windowStates') || {};
            Object.entries(states).forEach(([id, state]) => {
                if (state.type === 'immersive') {
                    window.immersiveBrowser?.launchUrl(state.url, state.title).then(newId => {
                        const windowEl = document.getElementById(newId);
                        if (windowEl) {
                            windowEl.style.left = `${state.position.x}px`;
                            windowEl.style.top = `${state.position.y}px`;
                            windowEl.style.width = `${state.size.width}px`;
                            windowEl.style.height = `${state.size.height}px`;
                        }
                    });
                } else if (state.type === 'browser') {
                    window.newBrowser?.createBrowserWindow().then(newId => {
                        const windowEl = document.getElementById(newId);
                        if (windowEl) {
                            windowEl.style.left = `${state.position.x}px`;
                            windowEl.style.top = `${state.position.y}px`;
                            windowEl.style.width = `${state.size.width}px`;
                            windowEl.style.height = `${state.size.height}px`;
                        }
                    });
                }
            });
        } catch (error) {
            console.warn('Failed to restore window states:', error);
        }
    }

    reuseWebview() {
        if (this.webviewPool.size > 0) {
            const webview = this.webviewPool.values().next().value;
            this.webviewPool.delete(webview);
            return webview;
        }
        return null;
    }

    storeWebview(webview) {
        if (this.webviewPool.size < this.maxPoolSize) {
            webview.src = 'about:blank';
            this.webviewPool.add(webview);
        }
    }

    cleanupWindow(windowId) {

        this.saveAllWindowStates();


        const windowEl = document.getElementById(windowId);
        if (!windowEl) return;

        // Remove event listeners
        if (this.eventListeners.has(windowEl)) {
            const listeners = this.eventListeners.get(windowEl);
            listeners.forEach((listenerSet, type) => {
                listenerSet.forEach(listener => {
                    windowEl.removeEventListener(type, listener);
                });
            });
            this.eventListeners.delete(windowEl);
        }

        // Remove from windows map
        this.windows.delete(windowId);
        windowEl.remove();
    }

    cleanupInactiveWindows() {
        this.windows.forEach((_, id) => {
            if (!document.getElementById(id)) {
                this.cleanupWindow(id);
            }
        });
    }

    dispose() {

        const states = {};
        this.windows.forEach((window, id) => {
            const webview = window.element.querySelector('webview');
            if (webview) {
                states[id] = {
                    position: {
                        x: window.element.offsetLeft,
                        y: window.element.offsetTop
                    },
                    size: {
                        width: window.element.offsetWidth,
                        height: window.element.offsetHeight
                    },
                    isMaximized: window.isMaximized,
                    type: window.element.classList.contains('immersive') ? 'immersive' : 'browser',
                    url: webview.src,
                    title: window.title
                };
            }
        });

        this.saveWindowStates(states);
        clearInterval(this.memoryInterval);
        this.webviewPool.clear();
        this.windows.forEach((_, id) => this.cleanupWindow(id));
        this.windows.clear();
        this.eventListeners = new WeakMap();
    }

    updateWindowTitle(windowId, title) {
        const window = this.windows.get(windowId);
        if (!window) return;

        window.title = title;
        const titleElement = window.element.querySelector('.title-text');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    updateWindowIcon(windowId, iconUrl) {
        const window = this.windows.get(windowId);
        if (!window) return;

        const iconElement = window.element.querySelector('.window-title .material-symbols-outlined');
        if (iconElement) {
            // Create favicon image
            const img = document.createElement('img');
            img.src = iconUrl;
            img.style.width = '16px';
            img.style.height = '16px';
            iconElement.replaceWith(img);
        }
    }

    createWindow({ title, content, position = null, isWidget = false, controls = MacLike, icon = null, immersive = false }) {
        const windowId = `window-${Date.now()}`;
        const windowEl = document.createElement('div');
        windowEl.id = windowId;
        windowEl.className = `window ${isWidget ? 'widget-window' : ''} ${immersive ? 'immersive' : ''}`;
        
        const windowIcon = icon || (isWidget ? 'widgets' : 'web');
        
        windowEl.innerHTML = `
            <div class="window-header ${immersive ? 'immersive-header' : ''}">
                <div class="window-title">
                    <span class="material-symbols-outlined">${windowIcon}</span>
                    <span class="title-text">${title}</span>
                </div>
                <div class="window-controls">${immersive ? this.constructor.ImmersiveControls : controls}</div>
            </div>
            <div class="window-content">${content}</div>
            <div class="resize-handle"></div>
        `;

        // Add immersive mode handlers
        if (immersive) {
            this.setupImmersiveMode(windowEl);
        }
    
        // Set initial position
        if (position) {
            windowEl.style.left = `${position.x}px`;
            windowEl.style.top = `${position.y}px`;
        } else {
            const offset = (this.windows.size % 10) * 30;
            windowEl.style.left = `${50 + offset}px`;
            windowEl.style.top = `${50 + offset}px`;
        }

        // Set initial size
        windowEl.style.width = '600px';
        windowEl.style.height = '400px';

        // const savedStates = await window.electronAPI.store.get('windowStates') || {};
        // if (savedStates[windowId]) {
        //     const state = savedStates[windowId];
        //     windowEl.style.left = `${state.position.x}px`;
        //     windowEl.style.top = `${state.position.y}px`;
        //     windowEl.style.width = `${state.size.width}px`;
        //     windowEl.style.height = `${state.size.height}px`;
        // }

        window.electronAPI.store.get('windowStates')
        .then(savedStates => {
            savedStates = savedStates || {};
            if (savedStates[windowId]) {
                const state = savedStates[windowId];
                windowEl.style.left = `${state.position.x}px`;
                windowEl.style.top = `${state.position.y}px`;
                windowEl.style.width = `${state.size.width}px`;
                windowEl.style.height = `${state.size.height}px`;
            }
        })
        .catch(error => {
            console.warn('Failed to load window state:', error);
        });

    // Save state when window moves/resizes
    const saveState = () => this.saveAllWindowStates();
    windowEl.addEventListener('mouseup', saveState);



        // Add to DOM
        document.body.appendChild(windowEl);

        // Store window info
        const windowInfo = {
            id: windowId,
            element: windowEl,
            title,
            isWidget,
            isMaximized: false,
            prevState: null,
            lastActive: Date.now(),
            suspended: false
        };


    this.windows.set(windowId, windowInfo);

    const webview = windowEl.querySelector('webview');
    if (webview) {
        webview.style.transition = 'opacity 0.3s ease';
        webview.style.opacity = '0';
        
        // Add loading indicator
        const loader = document.createElement('div');
        loader.className = 'window-loader';
        loader.innerHTML = '<span class="material-symbols-outlined rotating">refresh</span>';
        windowEl.appendChild(loader);
        
        webview.addEventListener('dom-ready', () => {
            this.activateWindow(windowId);
        });

        webview.addEventListener('did-start-loading', () => {
            webview.style.opacity = '0';
            loader.style.display = 'flex';
        });

        webview.addEventListener('did-finish-load', () => {
            webview.style.opacity = '1';
            loader.style.display = 'none';
            
            // Store window state
            this.saveWindowState(windowId);
        });

        // Add throttling for background windows
        if (!isWidget) {
            this.setupBackgroundThrottling(webview);
        }
    } else {
        this.activateWindow(windowId);
    }

    // Set up event listeners
    this.setupWindowEvents(windowEl);
    this.makeDraggable(windowEl);
    this.setupResize(windowEl);
    this.bringToFront(windowId);

    return windowId;
}

activateWindow(windowId) {
    const window = this.windows.get(windowId);
    if (!window) return;

    if (this.activeWindow) {
        this.activeWindow.element.classList.remove('active');
    }

    window.lastActive = Date.now();
    window.suspended = false;
    this.activeWindow = window;
    window.element.classList.add('active');

    const webview = window.element.querySelector('webview');
    if (webview && webview.getWebContentsId) {
        try {
            webview.setZoomFactor(1);
            webview.send('resume-window');
        } catch (error) {
            console.warn('WebView not ready for zoom factor:', error);
        }
    }
}

    setupImmersiveMode(windowEl) {
        const header = windowEl.querySelector('.window-header');
        
        // Remove previous trigger/panel logic
        header.addEventListener('mouseenter', () => {
            header.style.opacity = '1';
            header.style.background = 'var(--sl-color-neutral-0)';
            header.style.pointerEvents = 'auto';
        });

        header.addEventListener('mouseleave', (e) => {
            // Check if we're still in the header area
            const rect = header.getBoundingClientRect();
            if (e.clientY > rect.bottom || e.clientY < rect.top ||
                e.clientX < rect.left || e.clientX > rect.right) {
                header.style.opacity = '0';
                header.style.pointerEvents = 'none';
            }
        });

        // Enable dragging when header is visible
        this.makeDraggable(windowEl);
    }


    setupWindowEvents(windowEl) {
        const windowId = windowEl.id;
        
        // Window controls
        windowEl.querySelectorAll('.window-controls sl-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.classList.contains('minimize') ? 'minimize' :
                              e.currentTarget.classList.contains('maximize') ? 'maximize' :
                              'close';
                this.handleWindowAction(windowId, action);
            });
        });

    // Add icon click handler for reload
    const icon = windowEl.querySelector('.window-title .material-symbols-outlined');
    if (icon) {
        icon.style.cursor = 'pointer';
        icon.title = 'Reload window';
        icon.addEventListener('click', () => {
            const webview = windowEl.querySelector('webview');
            if (webview) {
                webview.reload();
            }
            this.emit('windowReload', { windowId });
        });
    }

        // Double-click titlebar to maximize
        windowEl.querySelector('.window-header').addEventListener('dblclick', (e) => {
            if (!e.target.closest('.window-controls')) {
                this.handleWindowAction(windowId, 'maximize');
            }
        });

        // Focus on click
        windowEl.addEventListener('mousedown', () => this.bringToFront(windowId));
    }

    handleWindowAction(windowId, action) {
        const window = this.windows.get(windowId);
        if (!window) return;

        switch (action) {
            case 'minimize':
                window.element.style.display = 'none';
                if (this.dockManager) {
                    // Get the icon from the window's title bar
                    const iconElement = window.element.querySelector('.window-title .material-symbols-outlined');
                    const iconName = iconElement ? iconElement.textContent : 'window';
                    
                    this.dockManager.handleWindowMinimize(windowId, {
                        title: window.title,
                        icon: iconName, // Pass the icon name
                        restore: (id) => {
                            const win = this.windows.get(id);
                            if (win) {
                                win.element.style.display = 'flex';
                                this.bringToFront(id);
                                this.dockManager.handleWindowRestore(id);
                            }
                        }
                    });
                }
                break;

            case 'maximize':
                if (!window.isMaximized) {
                    // Store current position/size
                    window.prevState = {
                        width: window.element.style.width,
                        height: window.element.style.height,
                        left: window.element.style.left,
                        top: window.element.style.top
                    };

                    // Maximize
                    Object.assign(window.element.style, {
                        width: '100%',
                        height: '100%',
                        left: '0',
                        top: '0'
                    });

                    window.isMaximized = true;
                } else {
                    // Restore
                    Object.assign(window.element.style, window.prevState);
                    window.isMaximized = false;
                }
                
                this.emit('windowMaximized', { 
                    windowId, 
                    isMaximized: window.isMaximized 
                });
                break;

            case 'close':
                window.element.classList.add('closing');
                setTimeout(() => {
                    window.element.remove();
                    this.windows.delete(windowId);
                    this.emit('windowClosed', { windowId });
                }, 300);
                break;
        }
    }

    setupResize(windowEl) {
        const handle = windowEl.querySelector('.resize-handle');
        let isResizing = false;
        let startX, startY;
        let startWidth, startHeight;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(windowEl).width, 10);
            startHeight = parseInt(getComputedStyle(windowEl).height, 10);
    
            // Add a class while resizing
            windowEl.classList.add('resizing');
            
            // Prevent event from triggering drag
            e.stopPropagation();
            
            // Bring window to front while resizing
            this.bringToFront(windowEl.id);
        });
    
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
    
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
    
            // Enforce minimum size
            const minWidth = 400;
            const minHeight = 300;
    
            windowEl.style.width = `${Math.max(minWidth, width)}px`;
            windowEl.style.height = `${Math.max(minHeight, height)}px`;
        });
    
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                windowEl.classList.remove('resizing');
            }
        });
    
        // Show/hide handle on hover
        windowEl.addEventListener('mousemove', (e) => {
            const rect = windowEl.getBoundingClientRect();
            const isNearCorner = 
                e.clientX > rect.right - 20 && 
                e.clientY > rect.bottom - 20;
            
            handle.style.opacity = isNearCorner ? '1' : '0';
        });
    
        windowEl.addEventListener('mouseleave', () => {
            if (!isResizing) {
                handle.style.opacity = '0';
            }
        });
    }

    makeDraggable(windowEl) {
        const header = windowEl.querySelector('.window-header');
        let isDragging = false;
        let initialX, initialY;
        let currentX, currentY;

        const startDrag = (e) => {
            if (e.target.closest('.window-controls')) return;
            isDragging = true;
            initialX = e.clientX - windowEl.offsetLeft;
            initialY = e.clientY - windowEl.offsetTop;
            windowEl.classList.add('dragging');
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            // Screen edge snapping
            const snapDistance = 10;
            const maxX = window.innerWidth - windowEl.offsetWidth;
            const maxY = window.innerHeight - windowEl.offsetHeight;

            if (currentX < snapDistance) currentX = 0;
            if (currentY < snapDistance) currentY = 0;
            if (currentX > maxX - snapDistance) currentX = maxX;
            if (currentY > maxY - snapDistance) currentY = maxY;

            // Window docking
            const nearbyWindow = this.findNearbyWindow(windowEl, currentX, currentY);
            if (nearbyWindow) {
                const dockPosition = this.getDockPosition(windowEl, nearbyWindow, currentX, currentY);
                if (dockPosition) {
                    this.dockWindows(windowEl, nearbyWindow, dockPosition);
                    this.showDockingFeedback([windowEl, nearbyWindow]);
                    return;
                }
            }

            windowEl.style.left = `${currentX}px`;
            windowEl.style.top = `${currentY}px`;
        };

        const stopDrag = () => {
            isDragging = false;
            windowEl.classList.remove('dragging');
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    }

    showDockingFeedback(windows) {
        windows.forEach(window => {
            window.classList.add('docking-feedback');
            setTimeout(() => window.classList.remove('docking-feedback'), 300);
        });
    }

    getDockPosition(window1, window2, x, y) {
        const rect1 = window1.getBoundingClientRect();
        const rect2 = window2.getBoundingClientRect();
        const snapDistance = 2; // Reduced snap distance

        if (Math.abs(rect1.right - rect2.left) < snapDistance) return 'right';
        if (Math.abs(rect1.left - rect2.right) < snapDistance) return 'left';
        if (Math.abs(rect1.bottom - rect2.top) < snapDistance) return 'bottom';
        if (Math.abs(rect1.top - rect2.bottom) < snapDistance) return 'top';

        return null;
    }

    setupDockResize(window1, window2, position) {
        const resizer = document.createElement('div');
        resizer.className = `dock-resizer dock-resizer-${position}`;
        
        // Position resizer between windows
        const updateResizerPosition = () => {
            const rect1 = window1.getBoundingClientRect();
            const rect2 = window2.getBoundingClientRect();
            
            if (position === 'right' || position === 'left') {
                resizer.style.left = `${(rect1.right + rect2.left) / 2}px`;
                resizer.style.top = `${Math.min(rect1.top, rect2.top)}px`;
                resizer.style.height = `${Math.max(rect1.bottom, rect2.bottom) - Math.min(rect1.top, rect2.top)}px`;
            } else {
                resizer.style.top = `${(rect1.bottom + rect2.top) / 2}px`;
                resizer.style.left = `${Math.min(rect1.left, rect2.left)}px`;
                resizer.style.width = `${Math.max(rect1.right, rect2.right) - Math.min(rect1.left, rect2.left)}px`;
            }
        };

        document.body.appendChild(resizer);
        updateResizerPosition();

        // Resize handling
        let startX, startY;
        resizer.addEventListener('mousedown', (e) => {
            this.isDockResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            document.body.style.cursor = position === 'left' || position === 'right' ? 'ew-resize' : 'ns-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDockResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            if (position === 'left' || position === 'right') {
                const width1 = parseInt(window1.style.width) + deltaX;
                const width2 = parseInt(window2.style.width) - deltaX;
                if (width1 >= 200 && width2 >= 200) {
                    window1.style.width = `${width1}px`;
                    window2.style.width = `${width2}px`;
                    startX = e.clientX;
                }
            } else {
                const height1 = parseInt(window1.style.height) + deltaY;
                const height2 = parseInt(window2.style.height) - deltaY;
                if (height1 >= 200 && height2 >= 200) {
                    window1.style.height = `${height1}px`;
                    window2.style.height = `${height2}px`;
                    startY = e.clientY;
                }
            }
            
            updateResizerPosition();
        });

        document.addEventListener('mouseup', () => {
            this.isDockResizing = false;
            document.body.style.cursor = '';
        });
    }


    findNearbyWindow(currentWindow, x, y) {
        const snapDistance = 2;
        let nearest = null;
        let minDistance = snapDistance;

        this.windows.forEach((window) => {
            if (window.element === currentWindow) return;

            const rect = window.element.getBoundingClientRect();
            const distances = {
                left: Math.abs(x - rect.right),
                right: Math.abs(x + currentWindow.offsetWidth - rect.left),
                top: Math.abs(y - rect.bottom),
                bottom: Math.abs(y + currentWindow.offsetHeight - rect.top)
            };

            const minDist = Math.min(...Object.values(distances));
            if (minDist < minDistance) {
                minDistance = minDist;
                nearest = window.element;
            }
        });

        return nearest;
    }

    dockWindows(window1, window2, position) {
        const dockId = `dock-${Date.now()}`;
        this.dockedWindows.set(dockId, {
            windows: [window1, window2],
            position: position
        });

        this.setupDockResize(window1, window2, position);
        
        // Add visual indicator
        window1.classList.add('docked', `docked-${position}`);
        window2.classList.add('docked', `docked-${position === 'left' ? 'right' : 'right'}`);
    }

    bringToFront(windowId) {
        const window = this.windows.get(windowId);
        if (!window) return;

        this.zIndexCounter++;
        window.element.style.zIndex = this.zIndexCounter;
        
        // Update focus styling
        this.windows.forEach(w => {
            w.element.classList.toggle('window-focused', w.id === windowId);
        });
    }

    setDockManager(dockManager) {
        this.dockManager = dockManager;
    }

    // Event handling
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }

    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => callback(data));
        }
    }

    async loadSavedWindows() {
        try {
            const savedStates = await window.electronAPI.store.get('windowStates') || {};
            Object.entries(savedStates).forEach(([id, state]) => {
                if (state.type === 'immersive') {
                    window.immersiveBrowser?.launchUrl(state.url, state.title);
                } else if (state.type === 'browser') {
                    window.newBrowser?.createBrowserWindow(state.url);
                }
            });
        } catch (error) {
            console.warn('Failed to restore window states:', error);
        }
    }

    saveWindowState(windowId) {
        const window = this.windows.get(windowId);
        if (!window) return;

        const webview = window.element.querySelector('webview');
        const state = {
            position: {
                x: window.element.offsetLeft,
                y: window.element.offsetTop
            },
            size: {
                width: window.element.offsetWidth,
                height: window.element.offsetHeight
            },
            isMaximized: window.isMaximized,
            type: window.element.classList.contains('immersive') ? 'immersive' : 'browser',
            url: webview?.src,
            title: window.title
        };

        this.saveWindowStates({
            ...this.loadCurrentStates(),
            [windowId]: state
        });
    }

    loadCurrentStates() {
        try {
            return JSON.parse(localStorage.getItem('windowStates')) || {};
        } catch {
            return {};
        }
    }

    async saveWindowStates(states) {
        try {
            await window.electronAPI.store.set('windowStates', states);
            localStorage.setItem('windowStates', JSON.stringify(states));
        } catch (error) {
            console.error('Failed to save window states:', error);
        }
    }
}

export default WindowManager;