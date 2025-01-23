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

    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 1000;
        this.events = new Map();
        this.dockManager = null;
        
        // Bind methods
        this.createWindow = this.createWindow.bind(this);
        this.handleWindowAction = this.handleWindowAction.bind(this);
        
        // Set up window template
        this.windowTemplate = document.getElementById('window-template');
    }

    // createWindow({ title, content, position = null, isWidget = false, controls = WinLike }) {
    //     const windowId = `window-${Date.now()}`;
        
    //     // Create window element
    //     const windowEl = document.createElement('div');
    //     windowEl.id = windowId;
    //     windowEl.className = `window ${isWidget ? 'widget-window' : ''}`;
        
    //     // Use the passed or default controls
    //     windowEl.innerHTML = `
    //         <div class="window-header">
    //             <div class="window-title">
    //                 <span class="material-symbols-outlined">${isWidget ? 'widgets' : 'web'}</span>
    //                 <span class="title-text">${title}</span>
    //             </div>
    //             <div class="window-controls">${controls}</div>
    //         </div>
    //         <div class="window-content">${content}</div>
    //         <div class="resize-handle"></div>
    //     `;

    createWindow({ title, content, position = null, isWidget = false,  controls = WinLike, icon = null // Add icon parameter 
            }) {
        const windowId = `window-${Date.now()}`;
        
        // Create window element
        const windowEl = document.createElement('div');
        windowEl.id = windowId;
        windowEl.className = `window ${isWidget ? 'widget-window' : ''}`;
        
        // Determine icon - use passed icon, or default based on window type
        const windowIcon = icon || (isWidget ? 'widgets' : 'web');
        
        // Use the passed or default controls
        windowEl.innerHTML = `
            <div class="window-header">
                <div class="window-title">
                    <span class="material-symbols-outlined">${windowIcon}</span>
                    <span class="title-text">${title}</span>
                </div>
                <div class="window-controls">${controls}</div>
            </div>
            <div class="window-content">${content}</div>
            <div class="resize-handle"></div>
        `;
    
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

        // Add to DOM
        document.body.appendChild(windowEl);

        // Store window info
        this.windows.set(windowId, {
            id: windowId,
            element: windowEl,
            title,
            isWidget,
            isMaximized: false,
            prevState: null // Store previous position/size for maximize/restore
        });

        // Set up event listeners
        this.setupWindowEvents(windowEl);
        this.makeDraggable(windowEl);
        this.setupResize(windowEl);

        // Bring to front
        this.bringToFront(windowId);

        return windowId;
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
            
            header.style.cursor = 'grabbing';
            windowEl.classList.add('dragging');
        };

        const doDrag = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            // Add snap zones
            const snapDistance = 20;
            const maxX = window.innerWidth - windowEl.offsetWidth;
            const maxY = window.innerHeight - windowEl.offsetHeight;

            // Snap to edges
            if (currentX < snapDistance) currentX = 0;
            if (currentY < snapDistance) currentY = 0;
            if (currentX > maxX - snapDistance) currentX = maxX;
            if (currentY > maxY - snapDistance) currentY = maxY;

            windowEl.style.left = `${currentX}px`;
            windowEl.style.top = `${currentY}px`;
        };

        const stopDrag = () => {
            isDragging = false;
            header.style.cursor = 'grab';
            windowEl.classList.remove('dragging');
        };

        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
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
}

export default WindowManager;