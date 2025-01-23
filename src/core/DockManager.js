class DockManager {
    constructor() {
        this.dock = document.getElementById('dock');
        this.zones = new Map();
        this.minimizedWindows = new Map();
        
        // Load saved settings first
        this.loadSettings().then(() => {
            this.initializeZones();
            this.setupEventListeners();
            if (autoRestore) {
                this.restorePinnedApps();
            }

        });
    }

    async loadSettings() {
        // Load saved settings from electron-store
        this.settings = await window.electronAPI.store.get('dockSettings') || {
            animation: 'slide', // or 'fade'
            position: 'bottom',
            showTitles: false,
            transparency: 0.85,
            pinnedApps: [] // Array of pinned app configurations
        };

        // Apply settings
        this.applySettings();
    }

    applySettings() {
        // Apply visual settings
        this.dock.style.setProperty('--dock-opacity', this.settings.transparency);
        this.dock.setAttribute('data-position', this.settings.position);
        this.dock.setAttribute('data-animation', this.settings.animation);
    }

    async saveSettings() {
        // Save current settings
        await window.electronAPI.store.set('dockSettings', this.settings);
    }

    initializeZones() {
        // Create basic zones
        const zoneStructure = [
            {
                id: 'start',
                name: 'Start Zone',
                align: 'left',
                visible: true
            },
            {
                id: 'system',  // Add system zone
                name: 'System Controls',
                align: 'left',
                visible: true
            },
            {
                id: 'apps',
                name: 'Pinned Apps',
                align: 'left',
                visible: true
            },

            {
                id: 'windows',
                name: 'Active Windows',
                align: 'center',
                visible: true
            },
            {
                id: 'tray',
                name: 'System Tray',
                align: 'right',
                visible: true
            }
        ];

        // Create DOM elements for zones
        zoneStructure.forEach(zone => {
            const zoneEl = document.createElement('div');
            zoneEl.className = `dock-zone dock-zone-${zone.align}`;
            zoneEl.id = `dock-zone-${zone.id}`;
            
            this.zones.set(zone.id, {
                element: zoneEl,
                config: zone,
                items: new Map()
            });
        });

        this.renderZones();
    }

    renderZones() {
        // Clear dock
        this.dock.innerHTML = '';
        
        // Add zones in correct order
        const leftZones = [];
        const centerZones = [];
        const rightZones = [];

        this.zones.forEach((zone, id) => {
            if (!zone.config.visible) return;

            switch (zone.config.align) {
                case 'left':
                    leftZones.push(zone.element);
                    break;
                case 'center':
                    centerZones.push(zone.element);
                    break;
                case 'right':
                    rightZones.push(zone.element);
                    break;
            }
        });

        // Create zone containers
        const leftContainer = document.createElement('div');
        leftContainer.className = 'dock-zones-left';
        leftZones.forEach(zone => leftContainer.appendChild(zone));

        const centerContainer = document.createElement('div');
        centerContainer.className = 'dock-zones-center';
        centerZones.forEach(zone => centerContainer.appendChild(zone));

        const rightContainer = document.createElement('div');
        rightContainer.className = 'dock-zones-right';
        rightZones.forEach(zone => rightContainer.appendChild(zone));

        // Add to dock
        this.dock.appendChild(leftContainer);
        this.dock.appendChild(centerContainer);
        this.dock.appendChild(rightContainer);
    }

    async pinApp(appConfig) {
        const { id, title, icon, launchCommand } = appConfig;
        
        // Add to pinned apps if not already pinned
        if (!this.settings.pinnedApps.some(app => app.id === id)) {
            this.settings.pinnedApps.push({
                id,
                title,
                icon,
                launchCommand
            });

            // Add to dock
            this.addItem('apps', {
                id,
                title,
                icon,
                showTitle: this.settings.showTitles,
                onClick: () => this.launchApp(launchCommand),
                isPinned: true
            });

            // Save settings
            await this.saveSettings();
        }
    }

    async unpinApp(appId) {
        // Remove from pinned apps
        this.settings.pinnedApps = this.settings.pinnedApps.filter(app => app.id !== appId);
        
        // Remove from dock
        const zone = this.zones.get('apps');
        if (zone && zone.items.has(appId)) {
            zone.items.get(appId).element.remove();
            zone.items.delete(appId);
        }

        // Save settings
        await this.saveSettings();
    }

    async restorePinnedApps() {
        for (const app of this.settings.pinnedApps) {
            this.addItem('apps', {
                ...app,
                showTitle: this.settings.showTitles,
                onClick: () => this.launchApp(app.launchCommand),
                isPinned: true
            });
        }
    }

    addItem(zoneId, item) {
        console.log(`Adding item to zone ${zoneId}:`, item); // Debug log
        
        const zone = this.zones.get(zoneId);
        if (!zone) {
            console.warn(`Zone ${zoneId} not found`); // Debug log
            return false;
        }
    
        const itemEl = this.createDockItem(item);
        
        // If item has custom content (for applets), add it
        if (item.customContent) {
            const contentContainer = document.createElement('div');
            contentContainer.className = 'dock-item-content';
            contentContainer.appendChild(item.customContent);
            itemEl.appendChild(contentContainer);
        }
    
        // Add wheel event listener for volume applet
        if (item.id.startsWith('applet-') && item.title === 'Volume Control') {
            itemEl.addEventListener('wheel', (e) => {
                const applet = this.zones.get('tray').items.get(item.id);
                if (applet && applet.data.onWheel) {
                    applet.data.onWheel(e);
                }
            });
        }
    
        zone.items.set(item.id, { element: itemEl, data: item });
        zone.element.appendChild(itemEl);
        
        console.log(`Item ${item.id} added to ${zoneId}`, itemEl); // Debug log
        
        this.dock.classList.remove('hidden');
        return true;
    }


    createDockItem(item) {
        const dockItem = document.createElement('div');
        dockItem.className = `dock-item${item.isPinned ? ' pinned' : ''}`;
        
        // If we have custom content, just use that directly without creating buttons
        if (item.customContent) {
            dockItem.appendChild(item.customContent);
            return dockItem;
        }
        
        // Only create buttons for non-custom items
        const button = document.createElement('sl-button');
        button.variant = 'text';
        button.size = 'small';
    
        if (item.icon) {
            button.innerHTML = `<span class="material-symbols-outlined">${item.icon}</span>`;
        }
        
        if (item.onClick) {
            button.addEventListener('click', item.onClick);
        }
        
        dockItem.appendChild(button);
        return dockItem;
    }


    async showItemContextMenu(item, event) {
        console.log('Context menu triggered for item:', item);
    
        const menu = document.createElement('sl-menu');
        menu.classList.add('dock-context-menu');
        
        menu.innerHTML = `
            <sl-menu-item value="unpin">
                <span class="material-symbols-outlined">push_pin</span>
                Unpin from dock
            </sl-menu-item>
            <sl-divider></sl-divider>
            <sl-menu-item value="properties">
                <span class="material-symbols-outlined">settings</span>
                Properties
            </sl-menu-item>
        `;
    
        // Add to DOM with initial styles to prevent flicker
        menu.style.position = 'fixed';
        menu.style.visibility = 'hidden'; // Hide initially
        menu.style.zIndex = '10000';
        document.body.appendChild(menu);
    
        // Wait for menu to be ready
        await customElements.whenDefined('sl-menu');
        await menu.updateComplete;
    
        // Now get the real dimensions
        const menuRect = menu.getBoundingClientRect();
        console.log('Menu dimensions after ready:', menuRect);
    
        // Position from click point
        let left = event.clientX;
        let top = event.clientY - menuRect.height;
    
        // Keep menu within window bounds
        if (left + menuRect.width > window.innerWidth) {
            left = event.clientX - menuRect.width;
        }
        
        if (top < 0) {
            top = event.clientY;
        }
    
        // Apply final position
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        menu.style.visibility = 'visible'; // Show menu
    
        // Add animation
        menu.style.opacity = '0';
        menu.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            menu.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            menu.style.opacity = '1';
            menu.style.transform = 'translateY(0)';
        });
    
        // Event handlers
        menu.addEventListener('sl-select', e => {
            console.log('Menu item selected:', e.detail.item.value);
            switch (e.detail.item.value) {
                case 'unpin':
                    this.unpinApp(item.id);
                    break;
                case 'properties':
                    // Show properties dialog
                    break;
            }
            menu.remove();
        });
    
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // Handle minimized windows specifically in the windows zone
    handleWindowMinimize(windowId, windowInfo) {
        const item = {
            id: windowId,
            title: windowInfo.title,
            icon: windowInfo.icon,
            showTitle: false,
            onClick: () => {
                console.log('Attempting to restore window:', windowId);  // Debug log
                if (windowInfo.restore) {
                    windowInfo.restore(windowId);
                }
            },
            preview: `
                <div class="dock-preview-header">
                    <span class="material-symbols-outlined">${windowInfo.icon}</span>
                    <span class="dock-preview-title">${windowInfo.title}</span>
                </div>
            `
        };
    
        this.addItem('windows', item);
    }

    handleWindowRestore(windowId) {
        const zone = this.zones.get('windows');
        if (zone) {
            const item = zone.items.get(windowId);
            if (item) {
                item.element.remove();
                zone.items.delete(windowId);
            }
        }

        // Hide dock if all zones are empty
        if (this.isAllZonesEmpty()) {
            this.dock.classList.add('hidden');
        }
    }

    isAllZonesEmpty() {
        let isEmpty = true;
        this.zones.forEach(zone => {
            if (zone.items.size > 0) isEmpty = false;
        });
        return isEmpty;
    }

    setupEventListeners() {
        // Mouse enter/leave for dock visibility
        this.dock.addEventListener('mouseenter', () => {
            clearTimeout(this.hideTimeout);
        });

        this.dock.addEventListener('mouseleave', () => {
            if (this.isAllZonesEmpty()) {
                this.hideTimeout = setTimeout(() => {
                    this.dock.classList.add('hidden');
                }, 300);
            }
        });
    }
}

export default DockManager;