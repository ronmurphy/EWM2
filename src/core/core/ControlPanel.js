class ControlPanel {
    constructor() {
        this.dialog = null;
        this.activeDialog = null;
        this.settings = [
            {
                id: 'applet-settings',
                title: 'Applet Settings',
                icon: 'tune',
                action: () => this.showSetting(() => window.appletSettings?.show())
            },
            {
                id: 'dock-settings',
                title: 'Dock Settings',
                icon: 'dock_to_bottom',
                action: () => this.showSetting(() => window.dockSettings?.show())
            },
            {
                id: 'heavy-sites',
                title: 'Heavy Sites Manager',
                icon: 'speed',
                action: () => this.showSetting(() => window.heavySitesSettings?.show())
            }
        ];
    }

    async showSetting(showDialog) {
        this.dialog.hide();
        
        // Track the dialog that's about to be shown
        const dialog = await showDialog();
        this.activeDialog = dialog;

        // Add close handler to show control panel again
        const originalHide = dialog.hide;
        dialog.hide = () => {
            originalHide.call(dialog);
            if (this.dialog) {
                this.show();
            }
        };
    }

    async show() {
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.remove();
        }

        await customElements.whenDefined('sl-dialog');
        
        this.dialog = Object.assign(document.createElement('sl-dialog'), {
            label: 'System Settings',
            className: 'control-panel-dialog'
        });

        // Handle manual close
        this.dialog.addEventListener('sl-hide', () => {
            if (!this.activeDialog) {
                this.dialog = null;
            }
        });

        this.dialog.innerHTML = `
            <div class="settings-grid">
                ${this.settings.map(setting => `
                    <sl-button class="setting-button" data-id="${setting.id}">
                        <span class="material-symbols-outlined">${setting.icon}</span>
                        ${setting.title}
                    </sl-button>
                `).join('')}
            </div>
        `;

        document.body.appendChild(this.dialog);
        this.setupEventListeners();
        this.dialog.show();
    }

    setupEventListeners() {
        this.dialog.querySelectorAll('.setting-button').forEach(button => {
            const setting = this.settings.find(s => s.id === button.dataset.id);
            if (setting) {
                button.addEventListener('click', () => {
                    this.dialog.hide();
                    setting.action();
                });
            }
        });
    }
}

export default ControlPanel;