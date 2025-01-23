import WindowManager from "../../core/WindowManager.js"

class TerminalManager {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.store = window.electronAPI.store;
        this.defaultTerminals = {
            win32: 'powershell.exe',
            linux: 'xterm',  // Default Linux terminal
            darwin: 'Terminal.app'
        };
        this.terminals = new Map();
        this.commandHistory = [];
        this.historyIndex = -1;
        this.apiInitialized = false;

                // Initialize command system
                this.etmCommands = {
                    'widgets': {
                        'reset': this.resetWidgets.bind(this),
                        'list': this.listWidgets.bind(this),
                        'show': this.listWidgets.bind(this),
                        'clear': this.clearWidgets.bind(this),
                    },
                    'webapps': {
                        'list': this.listWebApps.bind(this),
                        'delete': this.deleteWebApp.bind(this),
                        'refresh': this.refreshWebAppIcons.bind(this),
                        'clear': this.clearWebApps.bind(this)
                    },
                    'set': {
                        'titlebar': this.setTitlebarStyle.bind(this),
                        'theme': this.setTheme.bind(this),
                    },
                    'weather': {
                        'city': this.setWeatherCity.bind(this),
                        'unit': this.setWeatherUnit.bind(this),
                        'help': this.showWeatherHelp.bind(this)
                    },
                    'reset': {
                        'widgets': this.resetWidgets.bind(this),
                        'settings': this.resetSettings.bind(this),
                    },
                    'create': {
                        'window': this.createWindow.bind(this),
                    },
                    'help': this.showHelp.bind(this)
                };
            

        // Wait for API to be available
        this.waitForAPI();
    }

    waitForAPI() {
        return new Promise((resolve) => {
            const check = () => {
                const api = window?.electronAPI;
                if (api && typeof api.sendCommand === 'function' && typeof api.onCommandOutput === 'function') {
                    console.log('Terminal API found:', api);
                    this.apiInitialized = true;
                    return true;
                }
                return false;
            };
    
            // Check immediately
            if (check()) {
                resolve(true);
                return;
            }
    
            // If not available, check periodically
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (check()) {
                    clearInterval(interval);
                    resolve(true);
                } else if (attempts >= 50) { // 5 seconds timeout
                    clearInterval(interval);
                    console.error('Terminal API initialization timeout');
                    resolve(false);
                }
            }, 100);
        });
    }

    async getTerminalCommand() {
        // Get user preference or default
        const userTerminal = await this.store.get('preferredTerminal');
        if (userTerminal) return userTerminal;
    
        // Get platform through electronAPI
        const platform = await window.electronAPI.getPlatform();
        return this.defaultTerminals[platform];
    }

    checkTerminalManagerAPI() {
        const apiCheck = {
            electronAPI: !!window.electronAPI,
            // browser: !!window.electronAPI?.browser,
            terminal: {
                // sendCommand: !!window.electronAPI?.browser?.sendCommand,
                // onCommandOutput: !!window.electronAPI?.browser?.onCommandOutput
                sendCommand: !!window.electronAPI.sendCommand,
                onCommandOutput: !!window.electronAPI.onCommandOutput
            }
        };
    
        console.log('Second Terminal Manager API check:', apiCheck);
    
        return apiCheck; // Return the result if you want to use it programmatically
    }


    async isFirstRun() {
        const savedTerminal = await this.store.get('preferredTerminal');
        return !savedTerminal;
    }

    async initializeDefaultTerminal() {
        const platform = await window.electronAPI.getPlatform();
        const defaultTerminals = {
            'win32': 'powershell.exe',
            'linux': 'xterm',
            'darwin': 'Terminal.app'
        };
        
        await this.store.set('preferredTerminal', defaultTerminals[platform]);
    }

    async createTerminalWindow() {
        await this.waitForAPI();
        if (!this.apiInitialized) {
            console.error('Cannot create terminal window - API not initialized');
            return null;
        }
    
        // Check if this is first run
        const isFirstRun = await this.isFirstRun();
        if (isFirstRun) {
            await this.initializeDefaultTerminal();
            await this.showTerminalConfigDialog();
            return;
        }
    
        const terminalCommand = await this.getTerminalCommand();
        if (!terminalCommand) {
            await this.showTerminalConfigDialog();
            return;
        }
    
        // Rest of terminal creation...
        const windowId = await this.windowManager.createWindow({
            title: 'Terminal',
            content: this.createTerminalHTML(),
            isWidget: false,
            controls: WindowManager.WinLike,
            className: 'terminal-container'
        });
    
        const terminalWindow = document.getElementById(windowId);
        if (terminalWindow) {
            try {
                const platform = await window.electronAPI.getPlatform();
                await window.electronAPI.spawnTerminal(terminalCommand);
                await this.initializeTerminal(windowId, platform);
            } catch (error) {
                console.error('Failed to launch terminal:', error);
                this.showTerminalConfigDialog();
            }
        }
        return windowId;
    }
    
    async initializeTerminal(windowId, platform) {
        const terminal = document.getElementById(windowId);
        const input = terminal.querySelector('.terminal-input');
        const configBtn = terminal.querySelector('.terminal-config-btn');
    
        // Add config button click handler
        configBtn.addEventListener('click', () => {
            this.showTerminalConfigDialog();
        });

        this.terminals.set(windowId, {
            history: [],
            historyIndex: -1,
            element: terminal,
            platform: platform
        });
    
        input.addEventListener('keydown', (e) => this.handleInput(e, windowId));
        
        const api = window.electronAPI;
        if (api && typeof api.onCommandOutput === 'function') {
            const handler = (output) => {
                this.handleOutput(output, windowId);
            };
            
            api.onCommandOutput(handler);
            this.handleOutput(`Terminal initialized (${platform}).\n`, windowId);
        }
    
        input.focus();
    }
    
    async showTerminalConfigDialog() {
        const dialog = Object.assign(document.createElement('sl-dialog'), {
            label: 'Terminal Settings',
            className: 'terminal-settings-dialog'
        });
    
        // Get current platform
        const platform = await window.electronAPI.getPlatform();
        
        // Show platform-specific options first
        const options = platform === 'win32' ? 
            `<sl-option value="powershell">PowerShell</sl-option>
             <sl-option value="cmd">Command Prompt</sl-option>` :
            `<sl-option value="xterm">XTerm</sl-option>
             <sl-option value="gnome-terminal">GNOME Terminal</sl-option>
             <sl-option value="konsole">Konsole</sl-option>`;
    
        dialog.innerHTML = `
            <sl-select label="Select Terminal">
                ${options}
                <sl-option value="custom">Custom...</sl-option>
            </sl-select>
            <sl-input 
                class="custom-terminal" 
                style="display:none"
                label="Custom Terminal Command"
                placeholder="Enter terminal command">
            </sl-input>
            <div slot="footer">
                <sl-button variant="primary" class="save-btn">Save</sl-button>
                <sl-button variant="default" class="cancel-btn">Cancel</sl-button>
            </div>
        `;
    
        document.body.appendChild(dialog);
        await this.setupConfigDialog(dialog);
        dialog.show();
    }
    

    createTerminalHTML() {
        return `
            <div class="terminal-window">
                <div class="terminal-output"></div>
                <div class="terminal-input-area">
                    <span class="terminal-prompt">></span>
                    <input type="text" class="terminal-input" 
                           placeholder="Enter command" 
                           autocomplete="off" 
                           spellcheck="false" />
                    <button class="terminal-config-btn">
                        <span class="material-symbols-outlined">settings</span>
                    </button>
                </div>
            </div>
        `;
    }

    async setupConfigDialog(dialog) {
        const select = dialog.querySelector('sl-select');
        const customInput = dialog.querySelector('.custom-terminal');
        const saveBtn = dialog.querySelector('.save-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');
    
        // Load current preference
        const currentTerminal = await this.store.get('preferredTerminal');
        if (currentTerminal) {
            select.value = currentTerminal;
        }
    
        select.addEventListener('sl-change', () => {
            customInput.style.display = select.value === 'custom' ? 'block' : 'none';
        });
    
        saveBtn.addEventListener('click', async () => {
            const value = select.value === 'custom' ? customInput.value : select.value;
            await this.store.set('preferredTerminal', value);
            dialog.hide();
            // Refresh terminal window
            this.createTerminalWindow();
        });
    
        cancelBtn.addEventListener('click', () => {
            dialog.hide();
        });
    }

    setupConfigEvents(windowId) {
        const window = document.getElementById(windowId);
        const select = window.querySelector('sl-select');
        const customInput = window.querySelector('.custom-terminal');

        select.addEventListener('sl-change', () => {
            if (select.value === 'custom') {
                customInput.style.display = 'block';
            } else {
                customInput.style.display = 'none';
                this.store.set('preferredTerminal', select.value);
            }
        });

        customInput.addEventListener('sl-change', () => {
            this.store.set('preferredTerminal', customInput.value);
        });
    }


    handleInput(event, windowId) {
        const input = event.target;
        const terminal = this.terminals.get(windowId);
        
        switch (event.key) {
            case 'Enter':
                const command = input.value.trim();
                if (command) {
                    this.executeCommand(command, windowId);
                    terminal.history.push(command);
                    terminal.historyIndex = terminal.history.length;
                    input.value = '';
                }
                break;

            case 'ArrowUp':
                if (terminal.historyIndex > 0) {
                    terminal.historyIndex--;
                    input.value = terminal.history[terminal.historyIndex];
                }
                event.preventDefault();
                break;

            case 'ArrowDown':
                if (terminal.historyIndex < terminal.history.length - 1) {
                    terminal.historyIndex++;
                    input.value = terminal.history[terminal.historyIndex];
                } else {
                    terminal.historyIndex = terminal.history.length;
                    input.value = '';
                }
                event.preventDefault();
                break;

            case 'Tab':
                event.preventDefault();
                // Could add tab completion here in the future
                break;
        }
    }


    async executeCommand(command, windowId) {
        try {
            const outputDiv = this.createOutputElement(`> ${command}`, 'command');
            this.appendOutput(outputDiv, windowId);
    
            if (command.trim().toLowerCase().startsWith('etm')) {
                await this.executeETMCommand(command.slice(3).trim(), windowId);
                return;
            }
    
            const terminal = this.terminals.get(windowId);
            const platform = terminal.platform;
            
            if (!window.electronAPI?.sendCommand) {
                throw new Error('Terminal command API not available');
            }
    
            // Platform specific command handling
            if (platform === 'win32') {
                await window.electronAPI.sendCommand(command);
            } else {
                await window.electronAPI.sendUnixCommand(command);
            }
    
        } catch (error) {
            console.error('Command execution error:', error);
            const errorDiv = this.createOutputElement(`Error: ${error.message}`, 'error');
            this.appendOutput(errorDiv, windowId);
        }
    }

    async executeETMCommand(command, windowId) {
        const parts = command.toLowerCase().trim().split(' ');
        const mainCommand = parts[0];
        const subCommand = parts[1];
        const args = parts.slice(2);

        if (!this.etmCommands[mainCommand]) {
            throw new Error(`Unknown ETM command: ${mainCommand}. Type 'etm help' for available commands.`);
        }

        if (mainCommand === 'help') {
            await this.etmCommands[mainCommand](subCommand, windowId);
            return;
        }

        if (!this.etmCommands[mainCommand][subCommand]) {
            throw new Error(`Unknown sub-command: ${subCommand}. Type 'etm help ${mainCommand}' for available options.`);
        }

        await this.etmCommands[mainCommand][subCommand](args, windowId);
    }

    // ETM Command Implementations
    async setTitlebarStyle(args, windowId) {
        const [style] = args;
        const validStyles = ['WinLike', 'MacLike', 'Shoelace'];
        
        if (!validStyles.includes(style)) {
            throw new Error(`Invalid style. Valid options are: ${validStyles.join(', ')}`);
        }

        await window.electronAPI.store.set('windowControls', style);
        this.handleOutput(`Window controls set to ${style}`, windowId);
    }

    async setTheme([theme], windowId) {
        // Theme setting implementation
    }

    async resetWidgets(args, windowId) {
        if (window.widgetManager) {
            await window.widgetManager.resetStorage();
            this.handleOutput('Widget storage has been reset to default state.', windowId);
            this.handleOutput('Default calendar widget created.', windowId);
        } else {
            throw new Error('Widget manager not available');
        }
    }

    async clearWidgets(args, windowId) {
        try {
            if (!args.includes('--force')) {
                this.handleOutput('Warning: This will remove all widgets and their settings.', windowId);
                this.handleOutput('Use "etm widgets clear --force" to confirm.', windowId);
                return;
            }
    
            if (window.widgetManager) {
                // Use set method to clear instead of delete
                await window.electronAPI.store.set('widgets', {});
                await window.electronAPI.store.set('widget-positions', {});
                await window.widgetManager.resetStorage();
                this.handleOutput('All widget data has been cleared.', windowId);
                this.handleOutput('Restart the application to complete the reset.', windowId);
            } else {
                throw new Error('Widget manager not available');
            }
        } catch (error) {
            throw new Error(`Failed to clear widgets: ${error.message}`);
        }
    }
    
    async listWidgets(args, windowId) {
        if (window.widgetManager) {
            const activeWidgets = [...window.widgetManager.activeWidgets.entries()];
            if (activeWidgets.length === 0) {
                this.handleOutput('No active widgets found.', windowId);
            } else {
                this.handleOutput('Active widgets:', windowId);
                activeWidgets.forEach(([id, widget]) => {
                    this.handleOutput(`  ${id} (${widget.type}):`, windowId);
                    this.handleOutput(`    Size: ${widget.width}x${widget.height}`, windowId);
                    this.handleOutput(`    Position: ${widget.x},${widget.y}`, windowId);
                });
            }
        } else {
            throw new Error('Widget manager not available');
        }
    }

    async listWebApps(args, windowId) {
        const webApps = await window.electronAPI.store.get('webApps') || [];
        if (webApps.length === 0) {
            this.handleOutput('No web apps found.', windowId);
            return;
        }
    
        this.handleOutput('Installed Web Apps:', windowId);
        webApps.forEach(app => {
            this.handleOutput(`  ${app.name}:`, windowId);
            this.handleOutput(`    URL: ${app.url}`, windowId);
            this.handleOutput(`    ID: ${app.id}`, windowId);
        });
    }
    
    async deleteWebApp([appNameOrId], windowId) {
        if (!appNameOrId) {
            throw new Error('Please provide a web app name or ID to delete');
        }
    
        const webApps = await window.electronAPI.store.get('webApps') || [];
        const index = webApps.findIndex(app => 
            app.id === appNameOrId || 
            app.name.toLowerCase() === appNameOrId.toLowerCase()
        );
    
        if (index === -1) {
            throw new Error(`Web app "${appNameOrId}" not found`);
        }
    
        const app = webApps[index];
        webApps.splice(index, 1);
        await window.electronAPI.store.set('webApps', webApps);
        
        this.handleOutput(`Deleted web app: ${app.name}`, windowId);
        
        // Refresh start menu if it exists
        if (window.startMenu) {
            window.startMenu.loadWebApps();
        }
    }
    
    async clearWebApps(args, windowId) {
        if (!args.includes('--force')) {
            this.handleOutput('Warning: This will remove all web apps.', windowId);
            this.handleOutput('Use "etm webapps clear --force" to confirm.', windowId);
            return;
        }
    
        await window.electronAPI.store.set('webApps', []);
        this.handleOutput('All web apps have been removed.', windowId);
        
        // Refresh start menu if it exists
        if (window.startMenu) {
            window.startMenu.loadWebApps();
        }
    }
    
    async refreshWebAppIcons(args, windowId) {
        const webApps = await window.electronAPI.store.get('webApps') || [];
        let updated = 0;
    
        for (const app of webApps) {
            try {
                const url = new URL(app.url);
                app.favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
                updated++;
            } catch (error) {
                this.handleOutput(`Failed to update icon for ${app.name}: ${error.message}`, windowId);
            }
        }
    
        await window.electronAPI.store.set('webApps', webApps);
        this.handleOutput(`Updated ${updated} web app icons.`, windowId);
        
        // Refresh start menu if it exists
        if (window.startMenu) {
            window.startMenu.loadWebApps();
        }
    }

    async handleWeatherCommands(args, windowId) {
        const subCommand = args[0];
        
        switch (subCommand) {
            case 'city':
                if (args[1]) {
                    await this.setWeatherCity(args.slice(1).join(' '), windowId);
                } else {
                    const currentCity = await window.electronAPI.store.get('weatherCity') || 'New York';
                    this.handleOutput(`Current city: ${currentCity}`, windowId);
                }
                break;
    
            case 'unit':
                if (args[1]) {
                    await this.setWeatherUnit(args[1], windowId);
                } else {
                    const currentUnit = await window.electronAPI.store.get('weatherUnit') || 'C';
                    this.handleOutput(`Current temperature unit: ${currentUnit}`, windowId);
                }
                break;
    
            case 'help':
                this.showWeatherHelp(windowId);
                break;
    
            default:
                this.handleOutput('Invalid weather command. Type "etm weather help" for usage.', windowId);
        }
    }
    
    async setWeatherCity(args, windowId) {
        const city = args.join(' ');
        if (!city) {
            const currentCity = await window.electronAPI.store.get('weatherCity') || 'New York';
            this.handleOutput(`Current city: ${currentCity}`, windowId);
            return;
        }
        
        try {
            await window.electronAPI.store.set('weatherCity', city);
            this.handleOutput(`Weather city set to: ${city}`, windowId);
            if (window.appletManager) {
                window.appletManager.refreshApplet('weather');
            }
        } catch (error) {
            this.handleOutput(`Error setting city: ${error.message}`, windowId);
        }
    }
    
    async setWeatherUnit(args, windowId) {
        const unit = args[0]?.toUpperCase();
        if (!unit) {
            const currentUnit = await window.electronAPI.store.get('weatherUnit') || 'C';
            this.handleOutput(`Current temperature unit: ${currentUnit}`, windowId);
            return;
        }
    
        if (unit !== 'C' && unit !== 'F') {
            this.handleOutput('Invalid unit. Use C for Celsius or F for Fahrenheit.', windowId);
            return;
        }
    
        try {
            await window.electronAPI.store.set('weatherUnit', unit);
            this.handleOutput(`Temperature unit set to: ${unit === 'C' ? 'Celsius' : 'Fahrenheit'}`, windowId);
            if (window.appletManager) {
                window.appletManager.refreshApplet('weather');
            }
        } catch (error) {
            this.handleOutput(`Error setting unit: ${error.message}`, windowId);
        }
    }

    async showWeatherHelp(args, windowId) {
        const help = `
    Weather Commands:
      etm weather city [cityname]    - Show or set weather city
      etm weather unit [C/F]         - Show or set temperature unit (Celsius/Fahrenheit)
      etm weather help               - Show this help message
    
    Examples:
      etm weather city London
      etm weather unit F
        `.trim();
        
        this.handleOutput(help, windowId);
    }

    async resetSettings(args, windowId) {
        // Settings reset implementation
    }

    async createWindow([url], windowId) {
        if (window.windowManager) {
            const controls = await window.electronAPI.store.get('windowControls') || 'WinLike';
            const newWindowId = await window.windowManager.createWindow({
                content: url,
                isWidget: false,
                controls
            });
            this.handleOutput(`Created window ${newWindowId}`, windowId);
        } else {
            throw new Error('Window manager not available');
        }
    }



async showHelp(command, windowId) {
    if (command) {
        // Show specific command help
        switch (command) {
            case 'widgets':
                this.handleOutput(`
Widget Commands:
  etm widgets list          - List all widgets
  etm widgets reset        - Reset widget positions
  etm widgets show         - Show widget list
  etm widgets clear        - Clear all widget data (use --force to confirm)
                `.trim(), windowId);
                break;

            case 'webapps':
                this.handleOutput(`
WebApp Commands:
  etm webapps list         - List all web apps
  etm webapps delete [id]  - Delete a web app
  etm webapps refresh      - Refresh web app icons
  etm webapps clear        - Remove all web apps
                `.trim(), windowId);
                break;

            case 'set':
                this.handleOutput(`
Settings Commands:
  etm set titlebar [style] - Set window titlebar style (WinLike/MacLike/Shoelace)
  etm set theme [name]     - Set application theme
                `.trim(), windowId);
                break;

            case 'weather':
                this.handleOutput(`
Weather Commands:
  etm weather city [name]  - Show or set weather city
  etm weather unit [C/F]   - Show or set temperature unit
  etm weather help         - Show weather help
                `.trim(), windowId);
                break;

            case 'reset':
                this.handleOutput(`
Reset Commands:
  etm reset widgets        - Reset all widgets
  etm reset settings       - Reset all settings
                `.trim(), windowId);
                break;

            case 'create':
                this.handleOutput(`
Create Commands:
  etm create window        - Create a new window
                `.trim(), windowId);
                break;

            default:
                this.handleOutput(`Unknown command: ${command}. Type 'etm help' for all commands.`, windowId);
        }
    } else {
        // Show general help
        this.handleOutput(`
ETM Command Line Interface

Available Commands:
  etm widgets [action]     - Manage widgets
  etm webapps [action]     - Manage web applications
  etm set [option]         - Configure settings
  etm weather [action]     - Configure weather settings
  etm reset [target]       - Reset various components
  etm create [item]        - Create new items

Type 'etm help [command]' for specific command help
Example: 'etm help widgets'
        `.trim(), windowId);
    }
}


    handleOutput(output, windowId) {
        const outputDiv = this.createOutputElement(output);
        this.appendOutput(outputDiv, windowId);
    }


    createOutputElement(content, className = '') {
        const div = document.createElement('div');
        div.className = `terminal-line ${className}`;
        div.textContent = content;
        return div;
    }


    appendOutput(element, windowId) {
        const terminal = this.terminals.get(windowId);
        if (!terminal) return;

        const output = terminal.element.querySelector('.terminal-output');
        output.appendChild(element);
        output.scrollTop = output.scrollHeight;

        // Focus the input
        const input = terminal.element.querySelector('.terminal-input');
        input.focus();
    }
}


export default TerminalManager;