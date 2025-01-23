class HeavySitesSettings {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.dialog = null;
        this.defaultSites = [
            { domain: 'facebook.com', zoomFactor: 0.8 },
            { domain: 'messenger.com', zoomFactor: 0.8 },
            { domain: 'bing.com', zoomFactor: 0.8 }
        ];
        this.loadHeavyDomains();
    }

    async show() {
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.remove();
        }

        try {
            await customElements.whenDefined('sl-dialog');
            
            this.dialog = Object.assign(document.createElement('sl-dialog'), {
                label: 'Heavy Sites Manager',
                className: 'heavy-sites-dialog'
            });

            const sites = await this.loadSites();
            
            this.dialog.innerHTML = `
                <div class="sites-list">
                    ${sites.map(site => `
                        <div class="site-item" data-domain="${site.domain}">
                            <sl-input 
                                value="${site.domain}"
                                placeholder="Domain"
                                class="domain-input"
                            ></sl-input>
                            <sl-range
                                min="0.5"
                                max="0.9"
                                step="0.1"
                                value="${site.zoomFactor}"
                                class="zoom-slider"
                                label="Zoom Level"
                            ></sl-range>
                            <sl-button class="delete-btn" variant="danger">
                                <sl-icon name="trash"></sl-icon>
                            </sl-button>
                        </div>
                    `).join('')}
                </div>
                <sl-button variant="primary" class="add-site-btn">
                    <sl-icon slot="prefix" name="plus-circle"></sl-icon>
                    Add Site
                </sl-button>
                <div slot="footer">
                    <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
                    <sl-button variant="primary" class="save-btn">Save</sl-button>
                </div>
            `;

            document.body.appendChild(this.dialog);
            this.setupEventListeners();
            this.dialog.show();

        } catch (error) {
            console.error('Error showing heavy sites settings:', error);
        }
    }

    async loadHeavyDomains() {
        const heavySites = await window.electronAPI.store.get('heavySites') || this.defaultSites;
        this.windowManager.heavyDomains = heavySites;
    }

    async loadSites() {
        return await window.electronAPI.store.get('heavySites') || this.defaultSites;
    }

    async saveSites(sites) {
        await window.electronAPI.store.set('heavySites', sites);
        this.windowManager.heavyDomains = sites;
    }

    async deleteSite(domain) {
        const sites = await this.loadSites();
        const filtered = sites.filter(site => site.domain !== domain);
        await this.saveSites(filtered);
    }

    setupEventListeners() {
        const addBtn = this.dialog.querySelector('.add-site-btn');
        const saveBtn = this.dialog.querySelector('.save-btn');
        const cancelBtn = this.dialog.querySelector('.cancel-btn');
        const sitesList = this.dialog.querySelector('.sites-list');

        addBtn.addEventListener('click', () => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.innerHTML = `
                <sl-input 
                    placeholder="Domain"
                    class="domain-input"
                ></sl-input>
                <sl-range
                    min="0.5"
                    max="0.9"
                    step="0.1"
                    value="0.8"
                    class="zoom-slider"
                    label="Zoom Level"
                ></sl-range>
                <sl-button class="delete-btn" variant="danger">
                    <sl-icon name="trash"></sl-icon>
                </sl-button>
            `;
            sitesList.appendChild(siteItem);
        });

        this.dialog.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) {
                e.target.closest('.site-item').remove();
            }
        });

        saveBtn.addEventListener('click', async () => {
            const sites = Array.from(this.dialog.querySelectorAll('.site-item')).map(item => ({
                domain: item.querySelector('.domain-input').value,
                zoomFactor: parseFloat(item.querySelector('.zoom-slider').value)
            })).filter(site => site.domain);

            await this.saveSites(sites);
            this.dialog.hide();
        });

        cancelBtn.addEventListener('click', () => {
            this.dialog.hide();
        });
    }
}

export default HeavySitesSettings;