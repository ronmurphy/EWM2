import WindowManager from "../../core/WindowManager.js"


// class NewBrowser {
//     constructor(windowManager) {
//         this.windowManager = windowManager;
//         this.tabGroups = new Map();
//         this.tabCounter = 0;
//         this.pinnedSites = JSON.parse(localStorage.getItem('pinnedSites')) || [];
//         this.themes = ['flat', 'dark', 'minimal', 'futuristic', 'windows11', 'macos', 'gnome', 'kde'];
//         this.currentThemeIndex = 2;
//         this.blockCount = 0;
//         this.isBlockingEnabled = true;
//         this.pinnedTabs = new Set();
//         this.loadPinnedTabs();

//         // Initialize ad blocker when browser is created
//         this.initializeAdBlocker();
//     }

class NewBrowser {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.tabGroups = new Map();
        this.tabCounter = 0;
        this.pinnedSites = new Set();
        this.pinnedTabs = new Set();
        this.loadPinnedData();        
        this.themes = ['flat', 'dark', 'minimal', 'futuristic', 'windows11', 'macos', 'gnome', 'kde'];
        this.currentThemeIndex = 2;
        this.blocker = null;
        this.isBlockingEnabled = false;
        this.initializeAdBlocker();
        this.loadPinnedTabs();
    }


    async getAdBlocker() {
        try {
            ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
                path: 'engine.bin',
                read: (path) => window.electronAPI.blockerFS.readFile(path),
                write: (path, data) => window.electronAPI.blockerFS.writeFile(path, data),
            }).then((blocker) => {
                blocker.enableBlockingInSession(session.defaultSession);
            });
            console.log('adblocker update downloaded');
        } catch (error) {
            console.error('Failed to initialize ad blocker:', error);
        }
    }

    async initializeAdBlocker() {
        try {
            this.getAdBlocker();
        } catch (error) {
            console.error('Failed to get ad blocker download:', error);
        }
        try {
            console.log('Attempting to initialize ad blocker...');
            if (!window.electronAPI || !window.electronAPI.browser) {
                throw new Error('Browser API not available');
            }
            const initialized = await window.electronAPI.browser.initializeBlocker();
            console.log('Initialization result:', initialized);
            if (initialized) {
                console.log('Ad blocker initialized in NewBrowser');
            }
        } catch (error) {
            console.error('Failed to initialize ad blocker:', error);
        }
    }

    async loadPinnedTabs() {
        try {
            const pinnedTabs = await window.electronAPI.store.get('pinnedTabs') || [];
            if (pinnedTabs.length > 0) {
                const windowId = await this.createBrowserWindow();
                for (const tab of pinnedTabs) {
                    await this.createNewTab(windowId, tab.url, true);
                }
            }
        } catch (error) {
            console.error('Failed to load pinned tabs:', error);
        }
    }

    async savePinnedTabs() {
        const pinnedTabs = Array.from(this.pinnedTabs).map(tabId => {
            const tab = this.findTabById(tabId);
            return {
                url: tab.webview.src,
                title: tab.button.querySelector('.tab-title').textContent
            };
        });
        await window.electronAPI.store.set('pinnedTabs', pinnedTabs);
    }

    async togglePinTab(tabId) {
        const tab = this.findTabById(tabId);
        if (!tab) return;

        const pinButton = tab.button.querySelector('.tab-pin');
        const windowId = this.getWindowIdForTab(tabId);
        
        if (this.pinnedTabs.has(tabId)) {
            this.pinnedTabs.delete(tabId);
            this.pinnedSites.delete(tab.webview.src);
            pinButton.classList.remove('active');
        } else {
            this.pinnedTabs.add(tabId);
            this.pinnedSites.add(tab.webview.src);
            pinButton.classList.add('active');
        }

        await this.savePinnedData();
        if (windowId) {
            this.updatePinnedSites(windowId);
        }
    }

    getWindowIdForTab(tabId) {
        for (const [windowId, tabs] of this.tabGroups.entries()) {
            if (tabs.some(tab => tab.id === tabId)) {
                return windowId;
            }
        }
        return null;
    }
    async loadPinnedData() {
        try {
            const savedPinnedSites = await window.electronAPI.store.get('pinnedSites') || [];
            const savedPinnedTabs = await window.electronAPI.store.get('pinnedTabs') || [];
            
            this.pinnedSites = new Set(savedPinnedSites);
            this.pinnedTabs = new Set(savedPinnedTabs);
        } catch (error) {
            console.error('Failed to load pinned data:', error);
        }
    }

    async savePinnedData() {
        try {
            await window.electronAPI.store.set('pinnedSites', Array.from(this.pinnedSites));
            await window.electronAPI.store.set('pinnedTabs', Array.from(this.pinnedTabs));
        } catch (error) {
            console.error('Failed to save pinned data:', error);
        }
    }

    async togglePinTab(tabId) {
        const tab = this.findTabById(tabId);
        if (!tab) return;

        const pinButton = tab.button.querySelector('.tab-pin');
        
        if (this.pinnedTabs.has(tabId)) {
            this.pinnedTabs.delete(tabId);
            pinButton.classList.remove('active');
        } else {
            this.pinnedTabs.add(tabId);
            pinButton.classList.add('active');
            // Also add to pinned sites
            this.pinnedSites.add(tab.webview.src);
        }

        await this.savePinnedData();
        this.updatePinnedSites(tab.windowId);
    }

    async createBrowserWindow() {
        const windowId = await this.windowManager.createWindow({
            title: 'New Browser',
            content: this.createBrowserHTML(),
            isWidget: false,
            controls: WindowManager.MacLike,
            className: 'new-browser-container'
        });

        // Store the active window ID for pinned sites
        this.activeWindowId = windowId;

        const browserWindow = document.getElementById(windowId);
        if (browserWindow) {
            this.initializeTabBar(windowId);
            this.setupDrawerControls(windowId);
            await this.createNewTab(windowId, 'https://start.duckduckgo.com');
        }

        const savedStates = await window.electronAPI.store.get('windowStates') || {};
        const savedState = Object.values(savedStates).find(
            state => state.type === 'browser'
        );

        if (savedState) {
            browserWindow.style.left = `${savedState.position.x}px`;
            browserWindow.style.top = `${savedState.position.y}px`;
            browserWindow.style.width = `${savedState.size.width}px`;
            browserWindow.style.height = `${savedState.size.height}px`;
        }

        return windowId;
    }

    createBrowserHTML() {
        return `
        <div class="browser-container">
            <div class="browser-controls">
                <div class="upper-controls">
                    <div class="tab-section">
                        <sl-button-group class="tab-buttons">
                            <!-- Tabs will be inserted here -->
                        </sl-button-group>
                    </div>
                    <div class="tools-section">
                        <sl-button size="small" class="pin-button" title="Pin current page">
                            <sl-icon name="pin"></sl-icon>
                        </sl-button>
                        <sl-button size="small" class="bookmarks-button" title="Show pinned sites">
                            <sl-icon name="bookmark"></sl-icon>
                        </sl-button>
                        <sl-button size="small" class="theme-toggle" title="Change theme">
                            <sl-icon name="palette"></sl-icon>
                        </sl-button>
                    </div>
                </div>
                <div class="lower-controls">
                    <div class="nav-section">
                        <sl-button-group class="nav-controls">
                            <sl-button size="small" class="nav-back" disabled>
                                <sl-icon name="arrow-left"></sl-icon>
                            </sl-button>
                            <sl-button size="small" class="nav-forward" disabled>
                                <sl-icon name="arrow-right"></sl-icon>
                            </sl-button>
                            <sl-button size="small" class="nav-refresh">
                                <sl-icon name="arrow-clockwise"></sl-icon>
                            </sl-button>
                            <sl-button size="small" class="new-tab-button">
                                <sl-icon name="plus"></sl-icon>
                        </sl-button>
                        </sl-button-group>
                    </div>
                    <div class="url-section">
                        <div class="url-wrapper">
                            <sl-input 
                                class="url-input" 
                                type="text" 
                                placeholder="Enter URL or search terms"
                                size="small"
                                clearable
                            ></sl-input>
                            <div class="loading-progress"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="browser-content">
                <div class="tabs-container">
                    <!-- Webviews will be inserted here -->
                </div>
            </div>
            <sl-drawer label="Pinned Sites" class="pinned-sites-drawer" placement="end" style="--size: 50%;">
                <div class="pinned-sites-grid">
                    <!-- Pinned sites will be inserted here -->
                </div>
                <sl-button slot="footer" variant="primary">Close</sl-button>
            </sl-drawer>
        </div>
    `;
    }


//     async createNewTab(windowId, url = 'https://start.duckduckgo.com') {
//         const tabId = `tab-${this.tabCounter++}`;
//         const window = document.getElementById(windowId);
//         const tabButtons = window.querySelector('.tab-buttons');
//         const tabsContainer = window.querySelector('.tabs-container');

//         // Create tab button with pin option
//         const tabButton = document.createElement('sl-button');
//         tabButton.variant = 'default';
//         tabButton.size = 'small';
//         tabButton.classList.add('tab-button');
//     //     tabButton.innerHTML = `
//     //     <img class="tab-favicon" src="https://${new URL(url).hostname}/favicon.ico" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
//     //     <span class="tab-title">New Tab</span>
//     //     <sl-icon-button name="x" class="tab-close"></sl-icon-button>
//     // `;

//     tabButton.innerHTML = `
//     <div class="tab-content">
//         <img class="tab-favicon" src="https://${new URL(url).hostname}/favicon.ico" 
//             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
//         <span class="tab-title">New Tab</span>
//         <sl-icon-button 
//             class="tab-pin ${isPinned ? 'active' : ''}" 
//             name="pin" 
//             label="Pin tab"
//         ></sl-icon-button>
//         <sl-icon-button 
//             class="tab-close" 
//             name="x" 
//             label="Close tab"
//         ></sl-icon-button>
//     </div>
// `;



async createNewTab(windowId, url = 'https://start.duckduckgo.com', isPinned = false) {
    const tabId = `tab-${this.tabCounter++}`;
    const window = document.getElementById(windowId);
    const tabButtons = window.querySelector('.tab-buttons');
    const tabsContainer = window.querySelector('.tabs-container');

    const tabButton = document.createElement('sl-button');
    tabButton.variant = 'default';
    tabButton.size = 'small';
    tabButton.classList.add('tab-button');

    const hostname = new URL(url).hostname;
    tabButton.innerHTML = `
        <div class="tab-content">
            <img class="tab-favicon" src="https://${hostname}/favicon.ico" 
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
            <span class="tab-title">New Tab</span>
            <div class="tab-controls">
                <sl-icon-button class="tab-pin ${isPinned ? 'active' : ''}" name="pin" label="Pin tab"></sl-icon-button>
                <sl-icon-button class="tab-close" name="x" label="Close tab"></sl-icon-button>
            </div>
        </div>
    `;

    // Setup close handler
    tabButton.querySelector('.tab-close').addEventListener('click', event => {
        event.stopPropagation();
        this.closeTab(windowId, tabId);
    });

        // Create webview
        const webview = document.createElement('webview');
        webview.setAttribute('src', url);
        webview.setAttribute('allowpopups', '');
        webview.classList.add('browser-webview');
    
        // Store visibility change handler for cleanup
        const visibilityHandler = () => {
            try {
                const currentUrl = webview.src ? new URL(webview.src) : null;
                if (currentUrl) {
                    const heavySite = this.windowManager.heavyDomains.find(site => 
                        currentUrl.hostname.includes(site.domain)
                    );
                    if (heavySite) {
                        webview.setZoomFactor(document.hidden ? 0.1 : heavySite.zoomFactor);
                    }
                }
            } catch (error) {
                console.warn('Error in visibility change handler:', error);
            }
        };

                // Setup pin functionality
                const pinButton = tabButton.querySelector('.tab-pin');
                pinButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.togglePinTab(tabId);
                });
        
                if (isPinned) {
                    this.pinnedTabs.add(tabId);
                }
    
        webview.addEventListener('dom-ready', () => {
            if (this.isBlockingEnabled && this.blocker) {
                this.blocker.enableBlockingInWebView(webview);
            }
    
            // Check if it's a heavy site
            try {
                const currentUrl = webview.src ? new URL(webview.src) : null;
                if (currentUrl) {
                    const heavySite = this.windowManager.heavyDomains.find(site => 
                        currentUrl.hostname.includes(site.domain)
                    );
                    if (heavySite) {
                        webview.setZoomFactor(heavySite.zoomFactor);
                        console.log(`Applied heavy site zoom factor ${heavySite.zoomFactor} for ${currentUrl.hostname}`);
                    }
                }
            } catch (error) {
                console.warn('Invalid URL in heavy sites check:', error);
            }
        });
    
        document.addEventListener('visibilitychange', visibilityHandler);
    
        // Add to DOM
        tabButtons.appendChild(tabButton);
        tabsContainer.appendChild(webview);
    
        // Store tab info
        const tabInfo = {
            id: tabId,
            button: tabButton,
            webview: webview,
            url: url,
            visibilityHandler // Store handler for cleanup
        };
        this.tabGroups.get(windowId).push(tabInfo);

        // Set up event handlers
        this.setupWebviewEvents(windowId, tabInfo);
        this.setupTabEvents(windowId, tabInfo);


        // Activate the new tab
        this.activateTab(windowId, tabId);

        return tabId;
    }

    setupWebviewEvents(windowId, tabInfo) {
        const window = document.getElementById(windowId);
        const urlInput = window.querySelector('.url-input');
        const navBack = window.querySelector('.nav-back');
        const navForward = window.querySelector('.nav-forward');

        if (window.electronAPI?.adBlocker) {  // Check if API exists
            tabInfo.webview.addEventListener('dom-ready', async () => {
                try {
                    const webContentsId = tabInfo.webview.getWebContentsId();
                    await window.electronAPI.adBlocker.enableBlocking(webContentsId);
                    this.updateBlockedCounter(windowId, tabInfo.id, 0);
                } catch (error) {
                    console.error('Error enabling ad blocking:', error);
                }
            });

            // Listen for block count updates
            window.electronAPI.adBlocker.onBlockCount((count) => {
                if (tabInfo.webview.getWebContentsId()) {
                    this.blockCounts.set(tabInfo.id, count);
                    this.updateBlockedCounter(windowId, tabInfo.id, count);
                }
            });
        }

        const progressBar = window.querySelector('.loading-progress');

        const updateTabTitle = (title) => {
            const titleElement = tabInfo.button.querySelector('.tab-title');
            // Limit title to 20 characters
            titleElement.textContent = title.length > 20 ? title.substring(0, 20) + '...' : title;
            // Add full title as tooltip
            tabInfo.button.title = title;
        };


        tabInfo.webview.addEventListener('did-start-loading', () => {
            // tabInfo.button.querySelector('.tab-title').textContent = 'Loading...';
            updateTabTitle('Loading...');

            progressBar.style.width = '30%';

        });

        tabInfo.webview.addEventListener('did-navigate-in-page', () => {
            progressBar.style.width = '70%';
        });

        tabInfo.webview.addEventListener('did-finish-load', () => {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0';
            }, 300);
            const title = tabInfo.webview.getTitle() || 'New Tab';
            // tabInfo.button.querySelector('.tab-title').textContent = title;
            updateTabTitle(title);

            urlInput.value = tabInfo.webview.getURL();
        });

        tabInfo.webview.addEventListener('page-title-updated', (e) => {
            // tabInfo.button.querySelector('.tab-title').textContent = e.title;
            updateTabTitle(e.title);

        });

        tabInfo.webview.addEventListener('did-navigate', (e) => {
            urlInput.value = e.url;
            navBack.disabled = !tabInfo.webview.canGoBack();
            navForward.disabled = !tabInfo.webview.canGoForward();
        });

        tabInfo.webview.addEventListener('page-favicon-updated', (e) => {
            const favicon = tabInfo.button.querySelector('.tab-favicon');
            if (favicon && e.favicons && e.favicons.length > 0) {
                favicon.src = e.favicons[0];
            }
        });
    }

    findTabById(tabId) {
        for (const tabs of this.tabGroups.values()) {
            const tab = tabs.find(t => t.id === tabId);
            if (tab) return tab;
        }
        return null;
    }

    findActiveTab(windowId) {
        const tabs = this.tabGroups.get(windowId);
        return tabs?.find(tab => 
            tab.button.classList.contains('active')
        );
    }
    
    setupTabEvents(windowId, tabInfo) {
        // Tab button click
        tabInfo.button.addEventListener('click', () => {
            this.activateTab(windowId, tabInfo.id);
        });

        // Tab close button - Fixed event handler
        tabInfo.button.querySelector('.tab-close').addEventListener('click', (event) => {
            event.stopPropagation();
            document.removeEventListener('visibilitychange', tabInfo.visibilityHandler);
            this.closeTab(windowId, tabInfo.id);
        });

        // Pin button - Fixed event handler
        tabInfo.button.querySelector('.tab-pin').addEventListener('click', async (event) => {
            event.stopPropagation();
            await this.togglePinTab(tabInfo.id);
        });
    }

    // setupDrawerControls(windowId) {
    //     const window = document.getElementById(windowId);
    //     const drawer = window.querySelector('.pinned-sites-drawer');
    //     const openButton = window.querySelector('.bookmarks-button');
    //     const closeButton = drawer.querySelector('sl-button[slot="footer"]');

    //     openButton.addEventListener('click', () => {
    //         this.updatePinnedSites(windowId);
    //         drawer.show();
    //     });

    //     closeButton.addEventListener('click', () => {
    //         drawer.hide();
    //     });
    // }

    setupDrawerControls(windowId) {
        const window = document.getElementById(windowId);
        const drawer = window.querySelector('.pinned-sites-drawer');
        const openButton = window.querySelector('.bookmarks-button');
        const closeButton = drawer.querySelector('sl-button[slot="footer"]');

        openButton.addEventListener('click', () => {
            this.updatePinnedSites(windowId);
            drawer.show();
        });

        closeButton.addEventListener('click', () => {
            drawer.hide();
        });
    }

    setupUrlHandler(windowId) {
        const window = document.getElementById(windowId);
        const urlInput = window.querySelector('.url-input');

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const activeTab = this.getActiveTab(windowId);
                if (activeTab) {
                    let url = urlInput.value.trim();

                    // Add protocol if missing
                    if (!/^https?:\/\//i.test(url)) {
                        // Check if it looks like a URL
                        if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(url)) {
                            url = 'https://' + url;
                        } else {
                            // Treat as a search query
                            url = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
                        }
                    }

                    activeTab.webview.loadURL(url);
                }
            }
        });
    }

    activateTab(windowId, tabId) {
        const tabs = this.tabGroups.get(windowId);
        tabs.forEach(tab => {
            const isActive = tab.id === tabId;
            tab.button.variant = isActive ? 'primary' : 'default';
            tab.webview.style.display = isActive ? 'flex' : 'none';
        });
    }

    closeTab(windowId, tabId) {
        const tabs = this.tabGroups.get(windowId);
        const index = tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;

        const tab = tabs[index];
        tab.button.remove();
        tab.webview.remove();
        tabs.splice(index, 1);

        // If we closed the last tab, close the window
        if (tabs.length === 0) {
            this.windowManager.closeWindow(windowId);
            this.tabGroups.delete(windowId);
            return;
        }

        // Activate another tab if we closed the active one
        if (tab.button.variant === 'primary') {
            const newTab = tabs[Math.min(index, tabs.length - 1)];
            this.activateTab(windowId, newTab.id);
        }
    }

    createPinnedSiteCard(site) {
        const card = document.createElement('div');
        card.className = 'pinned-site';
        card.innerHTML = `
            <img class="site-favicon" src="${site.favicon || `https://${new URL(site.url).hostname}/favicon.ico`}" 
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
            <div class="site-title">${site.title}</div>
            <sl-icon-button name="x" class="remove-pin"></sl-icon-button>
        `;

        // Handle click to open site
        const handleClick = (e) => {
            if (!e.target.closest('.remove-pin')) {
                this.createNewTab(this.activeWindowId, site.url);
                // Optionally close the drawer after clicking
                const drawer = document.querySelector('.pinned-sites-drawer');
                if (drawer) drawer.hide();
            }
        };

        card.addEventListener('click', handleClick, true);

        // Handle unpin
        const removeButton = card.querySelector('.remove-pin');
        removeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.unpinSite(site.url);
            card.remove();
        });

        return card;
    }

    // Add method to update pinned sites display
    // updatePinnedSites(windowId) {
    //     const window = document.getElementById(windowId);
    //     const grid = window.querySelector('.pinned-sites-grid');
    //     grid.innerHTML = '';

    //     this.pinnedSites.forEach(site => {
    //         grid.appendChild(this.createPinnedSiteCard(site));
    //     });
    // }

    updatePinnedSites(windowId) {
        const window = document.getElementById(windowId);
        if (!window) return;
        
        const drawer = window.querySelector('.pinned-sites-drawer');
        if (!drawer) return;
        
        const grid = drawer.querySelector('.pinned-sites-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        Array.from(this.pinnedSites).forEach(url => {
            const site = document.createElement('div');
            site.className = 'pinned-site';
            const domain = new URL(url).hostname;
            
            site.innerHTML = `
                <img src="https://${domain}/favicon.ico" 
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌐</text></svg>'">
                <span>${domain}</span>
                <sl-icon-button name="x" class="remove-pin"></sl-icon-button>
            `;

            site.addEventListener('click', () => {
                this.createNewTab(windowId, url);
                drawer.hide();
            });

            site.querySelector('.remove-pin').addEventListener('click', (e) => {
                e.stopPropagation();
                this.pinnedSites.delete(url);
                this.savePinnedData();
                this.updatePinnedSites(windowId);
            });

            grid.appendChild(site);
        });
    }

    // Add method to pin current site
    // async pinCurrentSite(windowId) {
    //     const activeTab = this.getActiveTab(windowId);
    //     if (!activeTab) return;

    //     const url = activeTab.webview.getURL();
    //     const title = activeTab.webview.getTitle() || url;
    //     const favicon = activeTab.button.querySelector('.tab-favicon').src;

    //     // Check if already pinned
    //     if (!this.pinnedSites.some(site => site.url === url)) {
    //         const site = { url, title, favicon };
    //         this.pinnedSites.push(site);
    //         localStorage.setItem('pinnedSites', JSON.stringify(this.pinnedSites));
    //         this.updatePinnedSites(windowId);
    //     }
    // }

    async pinCurrentSite(windowId) {
        const activeTab = this.findActiveTab(windowId);
        if (!activeTab) return;

        await this.togglePinTab(activeTab.id);
    }

    // Add method to unpin a site
    unpinSite(url) {
        this.pinnedSites = this.pinnedSites.filter(site => site.url !== url);
        localStorage.setItem('pinnedSites', JSON.stringify(this.pinnedSites));
    }

    cycleTheme(windowId) {
        const window = document.getElementById(windowId);
        this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
        const theme = this.themes[this.currentThemeIndex];

        console.log('Theme index:', this, this.currentThemeIndex);
        console.log(`theme-${theme}`)
        // Remove all theme classes
        this.themes.forEach(t => window.classList.remove(`theme-${t}`));
        // Add new theme class
        window.classList.add(`theme-${theme}`);
    }



    initializeTabBar(windowId) {
        const window = document.getElementById(windowId);
        const newTabButton = window.querySelector('.new-tab-button');
        const navBack = window.querySelector('.nav-back');
        const navForward = window.querySelector('.nav-forward');
        const navRefresh = window.querySelector('.nav-refresh');
        const pinButton = window.querySelector('.pin-button');
        const themeButton = window.querySelector('.theme-toggle');
        const urlInput = window.querySelector('.url-input');
        // const blockedButton = window.querySelector('.blocked-counter');
        // const blockedCounter = blockedButton.querySelector('.counter');


        // Initialize tab group for this window
        this.tabGroups.set(windowId, []);
        // Event Listeners
        if (urlInput) {
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const activeTab = this.getActiveTab(windowId);
                    if (activeTab) {
                        let url = urlInput.value.trim();

                        // Add protocol if missing
                        if (!/^https?:\/\//i.test(url)) {
                            // Check if it looks like a URL
                            if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(url)) {
                                url = 'https://' + url;
                            } else {
                                // Treat as a search query
                                url = `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
                            }
                        }

                        activeTab.webview.loadURL(url);
                    }
                }
            });
        }

        // Event Listeners
        newTabButton.addEventListener('click', () => {
            this.createNewTab(windowId);
        });

        navBack.addEventListener('click', () => {
            const activeTab = this.getActiveTab(windowId);
            if (activeTab && activeTab.webview.canGoBack()) {
                activeTab.webview.goBack();
            }
        });

        navForward.addEventListener('click', () => {
            const activeTab = this.getActiveTab(windowId);
            if (activeTab && activeTab.webview.canGoForward()) {
                activeTab.webview.goForward();
            }
        });

        navRefresh.addEventListener('click', () => {
            const activeTab = this.getActiveTab(windowId);
            if (activeTab) {
                activeTab.webview.reload();
            }
        });

        pinButton.addEventListener('click', () => {
            this.pinCurrentSite(windowId);
        });

        themeButton.addEventListener('click', () => {
            this.cycleTheme(windowId);
        });

    }

    getActiveTab(windowId) {
        const tabs = this.tabGroups.get(windowId);
        return tabs?.find(tab => tab.button.variant === 'primary');

    }
}

export default NewBrowser;