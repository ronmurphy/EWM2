class StartMenu {
    constructor() {
        this.widgets = new Map();
        this.webApps = new Map();
        this.modal = null;
        this.store = window.electronAPI.store;
    }

    async init() {
        await this.scanWidgets();
        await this.loadWebApps();
        this.createModal();
        this.setupEventListeners();
        return this;
    }

    async loadWebApps() {
        const savedApps = await this.store.get('webApps') || [];
        // Clear existing apps
        this.webApps.clear();
        
        for (const app of savedApps) {
            // Validate and update favicon if needed
            try {
                const url = new URL(app.url);
                // Test if favicon is accessible
                const testImg = new Image();
                await new Promise((resolve) => {
                    testImg.onload = () => resolve(true);
                    testImg.onerror = () => resolve(false);
                    testImg.src = app.favicon;
                });
    
                // Update favicon if not accessible
                if (!testImg.complete) {
                    app.favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
                }
            } catch (error) {
                console.warn(`Failed to validate favicon for ${app.name}:`, error);
                // Set default favicon
                app.favicon = `https://www.google.com/s2/favicons?domain=${new URL(app.url).hostname}&sz=128`;
            }
            
            this.webApps.set(app.id, app);
        }
    }
    

    async saveWebApp(appInfo) {
        const apps = Array.from(this.webApps.values());
        await this.store.set('webApps', apps);
    }

    setupEventListeners() {
        // Close when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    // createModal() {
    //     this.modal = document.createElement('div');
    //     this.modal.className = 'start-menu-modal';
        
    //     const content = document.createElement('div');
    //     content.className = 'start-menu-content';
        
    //     const searchBar = document.createElement('div');
    //     searchBar.className = 'start-menu-search';
    //     searchBar.innerHTML = `
    //         <sl-input placeholder="Search...">
    //             <sl-icon slot="prefix" name="search"></sl-icon>
    //         </sl-input>
    //     `;

    //     const sections = document.createElement('div');
    //     sections.className = 'start-menu-sections';
        
    //     const modulesSection = this.createSection('Modules', Array.from(this.widgets.entries()), this.createModuleCard.bind(this));
    //     const webAppsSection = this.createSection('Web Apps', Array.from(this.webApps.entries()), this.createWebAppCard.bind(this));
        
    //     const addWebAppBtn = document.createElement('sl-button');
    //     addWebAppBtn.variant = 'primary';
    //     addWebAppBtn.innerHTML = `
    //         <sl-icon slot="prefix" name="plus-circle"></sl-icon>
    //         Add Web App
    //     `;
    //     addWebAppBtn.addEventListener('click', () => this.showAddWebAppDialog());
    //     webAppsSection.appendChild(addWebAppBtn);

    //     const controlsContainer = document.createElement('div');
    //     controlsContainer.className = 'app-controls';
        
    //     const restartButton = document.createElement('sl-button');
    //     restartButton.variant = 'primary';

    //     restartButton.innerHTML = '<span class="material-symbols-outlined">refresh</span> Quick Restart';
    //     restartButton.addEventListener('click', () => {
    //         window.electronAPI.restartApp();
    //         this.hide();
    //     });
    
    //     const exitButton = document.createElement('sl-button');
    //     exitButton.variant = 'primary';

    //     exitButton.innerHTML = '<span class="material-symbols-outlined">logout</span> Exit App';
    //     exitButton.addEventListener('click', () => {
    //         window.electronAPI.exitApp();
    //         this.hide();
    //     });

    //     controlsContainer.appendChild(restartButton);
    //     controlsContainer.appendChild(exitButton);
    //     sections.appendChild(controlsContainer);

    //     sections.appendChild(modulesSection);
    //     sections.appendChild(webAppsSection);
        
    //     content.appendChild(searchBar);
    //     content.appendChild(sections);
    //     this.modal.appendChild(content);
    //     document.body.appendChild(this.modal);
    // }

        createModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.className = 'start-menu-modal';
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'start-menu-content';
        
        // Create search bar
        const searchBar = document.createElement('div');
        searchBar.className = 'start-menu-search';
        searchBar.innerHTML = `
            <sl-input placeholder="Search...">
                <sl-icon slot="prefix" name="search"></sl-icon>
            </sl-input>
        `;
    
        // Create sections container
        const sections = document.createElement('div');
        sections.className = 'start-menu-sections';
        
        // Create sections
        const modulesSection = this.createSection('Modules', 
            Array.from(this.widgets.entries()), 
            this.createModuleCard.bind(this)
        );
        
        const webAppsSection = this.createSection('Web Apps', 
            Array.from(this.webApps.entries()), 
            this.createWebAppCard.bind(this)
        );
        
        // Create Add Web App button
        const addWebAppBtn = document.createElement('sl-button');
        addWebAppBtn.variant = 'primary';
        addWebAppBtn.innerHTML = `
            <sl-icon slot="prefix" name="plus-circle"></sl-icon>
            Add Web App
        `;
        addWebAppBtn.addEventListener('click', () => this.showAddWebAppDialog());
        webAppsSection.appendChild(addWebAppBtn);
        
        // Create app control buttons
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'app-controls';
        
        const restartButton = document.createElement('sl-button');
        restartButton.variant = 'primary';
        restartButton.innerHTML = '<span class="material-symbols-outlined">refresh</span> Quick Restart';
        restartButton.addEventListener('click', async () => {
            try {
                await window.electronAPI.restartApp();
                this.hide();
            } catch (error) {
                console.error('Failed to restart app:', error);
            }
        });
    
        const exitButton = document.createElement('sl-button');
        exitButton.variant = 'primary';
        exitButton.innerHTML = '<span class="material-symbols-outlined">logout</span> Exit App';
        exitButton.addEventListener('click', async () => {
            try {
                await window.electronAPI.exitApp();
                this.hide();
            } catch (error) {
                console.error('Failed to exit app:', error);
            }
        });
    
        controlsContainer.appendChild(restartButton);
        controlsContainer.appendChild(exitButton);
    
        sections.appendChild(modulesSection);
        sections.appendChild(webAppsSection);
        sections.appendChild(controlsContainer);
        
        content.appendChild(searchBar);
        content.appendChild(sections);
        this.modal.appendChild(content);
        document.body.appendChild(this.modal);
    }

    async showAddWebAppDialog() {
        console.log('Opening web app dialog...');
    
        // Hide start menu first
        this.hide();
    
        try {
            // Wait for sl-dialog to be defined
            await customElements.whenDefined('sl-dialog');
            console.log('sl-dialog is defined');
    
            // Create and add dialog in one step
            const dialog = Object.assign(document.createElement('sl-dialog'), {
                label: 'Add Web App',
                className: 'add-webapp-dialog'
            });
    
            // Add the form content
            dialog.innerHTML = `
                <div class="add-webapp-form">
                    <sl-input name="name" label="Name" placeholder="My Web App" autofocus></sl-input>
                    <sl-input name="url" label="URL" placeholder="https://example.com" type="url"></sl-input>
                </div>
                <div slot="footer">
                    <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
                    <sl-button variant="primary" class="submit-btn">Add</sl-button>
                </div>
            `;
    
            document.body.appendChild(dialog);
            console.log('Dialog added to DOM:', dialog);
    
            // Get references to elements
            const nameInput = dialog.querySelector('[name="name"]');
            const urlInput = dialog.querySelector('[name="url"]');
            const submitBtn = dialog.querySelector('.submit-btn');
            const cancelBtn = dialog.querySelector('.cancel-btn');
    
            // Handle submit
            submitBtn.addEventListener('click', async () => {
                if (nameInput.value && urlInput.value) {
                    let url = urlInput.value;
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        url = 'https://' + url;
                    }
    
                    const domain = new URL(url).hostname;
                    const newApp = {
                        id: `web-app-${Date.now()}`,
                        name: nameInput.value,
                        url: url,
                        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
                    };
                    
                    this.webApps.set(newApp.id, newApp);
                    await this.saveWebApp(newApp);
                    this.refreshWebAppsSection();
                    dialog.hide();
                    setTimeout(() => dialog.remove(), 300);
                }
            });
    
            // Handle cancel
            cancelBtn.addEventListener('click', () => {
                dialog.hide();
                setTimeout(() => dialog.remove(), 300);
            });
    
            // Ensure dialog is ready before showing
            await dialog.updateComplete;
            
            // Show the dialog
            console.log('Showing dialog...');
            dialog.show();
    
        } catch (error) {
            console.error('Error creating dialog:', error);
        }
    }

    async scanWidgets() {
        console.log('StartMenu: Beginning widget scan');
        try {
            const widgetFolders = await window.electronAPI.scanWidgets();
            console.log('StartMenu: Found widget folders:', widgetFolders);
            
            for (const folder of widgetFolders) {
                console.log('StartMenu: Reading info for widget:', folder);
                const info = await window.electronAPI.readWidgetInfo(folder);
                if (info) {
                    console.log('StartMenu: Adding widget info:', info);
                    this.widgets.set(folder, info);
                }
            }
        } catch (error) {
            console.error('StartMenu: Error scanning widgets:', error);
        }
        console.log('StartMenu: Finished scanning widgets');
    }

    createSection(title, items, cardCreator) {
        const section = document.createElement('div');
        section.className = 'start-menu-section';
        
        const header = document.createElement('h2');
        header.textContent = title;
        section.appendChild(header);
        
        const grid = document.createElement('div');
        grid.className = 'grid-container';
        
        items.forEach(([id, info]) => {
            const card = cardCreator(id, info);
            grid.appendChild(card);
        });
        
        section.appendChild(grid);
        return section;
    }

    createModuleCard(folder, info) {
        const card = document.createElement('div');
        card.className = 'menu-card module-card';
        
        card.innerHTML = `
            <div class="card-icon">
                <span class="material-symbols-outlined">${info.icon || 'widgets'}</span>
            </div>
            <div class="card-info">
                <h3>${info.name}</h3>
                <p>${info.description}</p>
            </div>
        `;
        
        card.addEventListener('click', async () => {
            if (window.moduleViewer) {
                await window.moduleViewer.createModuleWindow(info, folder);
                this.hide();
            }
        });
        
        return card;
    }


    async deleteWebApp(id) {
        const app = this.webApps.get(id);
        if (!app) return;

        // Remove from map
        this.webApps.delete(id);

        // Update storage
        const apps = Array.from(this.webApps.values());
        await this.store.set('webApps', apps);

        // Refresh the display
        this.refreshWebAppsSection();
    }

    async refreshWebAppIcon(id) {
        const app = this.webApps.get(id);
        if (!app) return;

        try {
            const url = new URL(app.url);
            // Use Google's favicon service instead of direct favicon.ico
            app.favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
            
            // Update storage
            const apps = Array.from(this.webApps.values());
            await this.store.set('webApps', apps);

            // Refresh the display
            this.refreshWebAppsSection();
        } catch (error) {
            console.error('Failed to refresh web app icon:', error);
        }
    }

    // createWebAppCard(id, info) {
    //     const card = document.createElement('div');
    //     card.className = 'menu-card web-app-card';
        
    //     // Update the card HTML to use Google's favicon service by default
    //     const domain = new URL(info.url).hostname;
    //     const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        
    //     card.innerHTML = `
    //         <div class="card-icon">
    //             <img src="${faviconUrl}" onerror="this.src=''; this.className='material-symbols-outlined'; this.textContent='public'">
    //         </div>
    //         <div class="card-info">
    //             <h3>${info.name}</h3>
    //             <p>${info.url}</p>
    //         </div>
    //     `;
        
    //     card.addEventListener('click', async () => {
    //         if (window.webAppViewer) {
    //             await window.webAppViewer.createWebAppWindow(info);
    //             this.hide();
    //         }
    //     });

    //     card.addEventListener('contextmenu', (e) => {
    //         e.preventDefault();
    //         this.showWebAppContextMenu(e, id, info);
    //     });
        
    //     return card;
    // }

    createWebAppCard(id, info) {
        const card = document.createElement('div');
        card.className = 'menu-card web-app-card';
        
        const domain = new URL(info.url).hostname;
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        
        card.innerHTML = `
            <div class="card-icon">
                <img src="${faviconUrl}" onerror="this.src=''; this.className='material-symbols-outlined'; this.textContent='public'">
            </div>
            <div class="card-info">
                <h3>${info.name}</h3>
                <p>${info.url}</p>
            </div>
        `;
    
        card.addEventListener('click', async () => {
            try {
                await window.immersiveBrowser.launchUrl(info.url, info.name);
                this.hide();
            } catch (error) {
                console.error('Failed to launch immersive browser:', error);
            }
        });
    
        return card;
    }

    async showWebAppContextMenu(event, id, info) {
        const menu = document.createElement('sl-menu');
        menu.style.position = 'fixed';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;
        menu.style.zIndex = '100000';
        
        menu.innerHTML = `
            <sl-menu-item value="refresh">Refresh Icon</sl-menu-item>
            <sl-menu-item value="delete">Delete Web App</sl-menu-item>
        `;
    
        document.body.appendChild(menu);
    
        const handleSelection = async (e) => {
            const value = e.detail.item.value;
            
            if (value === 'delete') {
                await this.deleteWebApp(id);
            } else if (value === 'refresh') {
                await this.refreshWebAppIcon(id);
            }
            
            menu.remove();
        };
    
        menu.addEventListener('sl-select', handleSelection);
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }


    refreshWebAppsSection() {
        const section = this.modal.querySelector('.start-menu-section:nth-child(2)');
        const grid = section.querySelector('.grid-container');
        grid.innerHTML = '';
        
        this.webApps.forEach((info, id) => {
            const card = this.createWebAppCard(id, info);
            grid.appendChild(card);
        });
    }


// Add new method for positioning
positionModal() {
    const dockHeight = document.querySelector('.dock')?.offsetHeight || 48;
    const modalHeight = this.modal.offsetHeight || 600;
    
    // Windows 11 Style (centered)
    this.modal.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding-bottom: ${dockHeight + 20}px;
    `;

}

    createWidgetCard(folder, info) {
        const card = document.createElement('div');
        card.className = 'widget-card';
        
        card.innerHTML = `
            <div class="widget-icon">
                <span class="material-symbols-outlined">${info.icon || 'widgets'}</span>
            </div>
            <div class="widget-info">
                <h3>${info.name}</h3>
                <p>${info.description}</p>
            </div>
        `;
        
        card.addEventListener('click', async () => {
            if (window.moduleViewer) {
                await window.moduleViewer.createModuleWindow(info, folder);
                this.hide();
            } else {
                console.error('ModuleViewer not initialized');
            }
        });
        
        return card;
    }

    show() {
        this.modal.classList.add('active');
    }

    hide() {
        this.modal.classList.remove('active');
    }

    toggle() {
        this.modal.classList.toggle('active');
    }
}

export { StartMenu as default };