// AppletSettings.js
class AppletSettings {
    constructor(appletManager) {
        this.appletManager = appletManager;
        this.store = window.electronAPI.store;
        this.dialog = null;
    }

    async show() {
        // Hide any existing dialog
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.remove();
        }

        try {
            // Wait for sl-dialog to be defined
            await customElements.whenDefined('sl-dialog');

            // Create dialog
            this.dialog = Object.assign(document.createElement('sl-dialog'), {
                label: 'Applet Settings',
                className: 'applet-settings-dialog'
            });

            const content = await this.createSettingsContent();
            this.dialog.innerHTML = content;

            document.body.appendChild(this.dialog);
            this.setupEventListeners(this.dialog);
            this.dialog.show();

        } catch (error) {
            console.error('Error showing applet settings:', error);
        }
    }

// AppletSettings.js
async createSettingsContent() {
    const applets = this.appletManager.getRegisteredApplets();
    const settings = await this.store.get('appletSettings') || {};
    
    // Get currently loaded applets and their order
    const loadedApplets = Array.from(this.appletManager.applets.entries())
        .sort((a, b) => settings[a[0]]?.order - settings[b[0]]?.order);
    
    const currentOrder = new Map(loadedApplets.map(([id], index) => [id, index]));

    return `
        <div class="applet-list">
            ${Array.from(applets.entries())
                .sort((a, b) => {
                    // Put loaded applets first, in their current order
                    const aOrder = currentOrder.has(a[0]) ? currentOrder.get(a[0]) : Infinity;
                    const bOrder = currentOrder.has(b[0]) ? currentOrder.get(b[0]) : Infinity;
                    return aOrder - bOrder;
                })
                .map(([id, applet]) => `
                    <div class="applet-item" data-id="${id}">
                        <sl-checkbox 
                            ?checked="${this.appletManager.applets.has(id)}"
                            data-id="${id}"
                        >
                            <span class="material-symbols-outlined">${applet.icon || 'extension'}</span>
                            ${applet.name}
                        </sl-checkbox>
                    </div>
                `).join('')}
        </div>
        <div class="actions" style="padding: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <sl-button class="add-spacer-btn" variant="default">
                <sl-icon slot="prefix" name="plus-circle"></sl-icon>
                Add Spacer
            </sl-button>
        </div>
        <div slot="footer">
            <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
            <sl-button variant="primary" class="save-btn">Save</sl-button>
        </div>
    `;
}

    setupEventListeners(dialog) {
        const saveBtn = dialog.querySelector('.save-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');

        saveBtn.addEventListener('click', async () => {
            const settings = {};
            
            dialog.querySelectorAll('.applet-item').forEach((item, index) => {
                const id = item.dataset.id;
                const checkbox = item.querySelector('sl-checkbox');
                settings[id] = {
                    enabled: checkbox.checked,
                    order: index // Use index for order
                };
            });
    
            await this.appletManager.saveSettings(settings);
            dialog.hide();
        });

        cancelBtn.addEventListener('click', () => {
            dialog.hide();
        });

        dialog.addEventListener('sl-after-hide', () => {
            dialog.remove();
            this.dialog = null;
        });

        const addSpacerBtn = dialog.querySelector('.add-spacer-btn');
        addSpacerBtn.addEventListener('click', async () => {
            const spacerId = `spacer-${Date.now()}`;
            const spacerItem = document.createElement('div');
            spacerItem.className = 'applet-item';
            spacerItem.dataset.id = spacerId;
            
            spacerItem.innerHTML = `
                <sl-checkbox checked data-id="${spacerId}">
                    <span class="material-symbols-outlined">horizontal_rule</span>
                    Spacer
                </sl-checkbox>
            `;

            dialog.querySelector('.applet-list').appendChild(spacerItem);
        });

        // Add drag-drop if Sortable is available
        if (window.Sortable) {
            new Sortable(dialog.querySelector('.applet-list'), {
                animation: 150,
                ghostClass: 'sortable-ghost'
            });
        }
    }
}


export default AppletSettings;