// DockSettings.js
class DockSettings {
    constructor(windowManager) {
        this.store = window.electronAPI.store;
        this.dialog = null;
        this.loadInitialSettings(); // Call on construction
    }

    async loadInitialSettings() {
        try {
            const settings = await this.store.get('dockStyle') || { 
                style: 'taskbar', 
                blur: true 
            };
            this.applyDockStyles(settings);
        } catch (error) {
            console.error('Error loading dock settings:', error);
        }
    }

    async show() {
        if (this.dialog) {
            this.dialog.hide();
            this.dialog.remove();
        }

        try {
            await customElements.whenDefined('sl-dialog');
            
            this.dialog = Object.assign(document.createElement('sl-dialog'), {
                label: 'Dock Settings',
                className: 'dock-settings-dialog'
            });

            const content = `
                <div class="settings-group">
                    <sl-radio-group label="Dock Style" name="dock-style">
                        <sl-radio value="taskbar" checked>Windows-style Taskbar</sl-radio>
                        <sl-radio value="floating">macOS-style Floating Dock</sl-radio>
                    </sl-radio-group>
                </div>
                <div class="settings-group">
                    <sl-switch name="blur">Enable Blur Effect</sl-switch>
                </div>
                <div slot="footer">
                    <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
                    <sl-button variant="primary" class="save-btn">Save</sl-button>
                </div>
            `;

            this.dialog.innerHTML = content;
            document.body.appendChild(this.dialog);
            
            await this.setupEventListeners();
            await this.loadSettings();
            
            this.dialog.show();
        } catch (error) {
            console.error('Error showing dock settings:', error);
        }
    }

    async loadSettings() {
        const settings = await this.store.get('dockStyle') || { style: 'taskbar', blur: true };
        
        this.dialog.querySelector('sl-radio-group').value = settings.style;
        this.dialog.querySelector('sl-switch').checked = settings.blur;
    }

    async setupEventListeners() {
        const styleGroup = this.dialog.querySelector('sl-radio-group');
        const blurSwitch = this.dialog.querySelector('sl-switch');
        const saveBtn = this.dialog.querySelector('.save-btn');
        const cancelBtn = this.dialog.querySelector('.cancel-btn');

        const updateStyles = async () => {
            const settings = {
                style: styleGroup.value,
                blur: blurSwitch.checked
            };
            
            await this.store.set('dockStyle', settings);
            this.applyDockStyles(settings);
        };

        saveBtn.addEventListener('click', async () => {
            await updateStyles();
            this.dialog.hide();
        });

        cancelBtn.addEventListener('click', () => {
            this.dialog.hide();
        });

        this.dialog.addEventListener('sl-after-hide', () => {
            this.dialog.remove();
            this.dialog = null;
        });
    }

    applyDockStyles(settings) {
        const dock = document.querySelector('.dock');
        dock.className = 'dock';
        dock.classList.add(settings.style);
        
        if (settings.blur) {
            dock.classList.add('with-blur');
        }
    }
}

export default DockSettings;