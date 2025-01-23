import WindowManager from './core/WindowManager.js';
import DockManager from './core/DockManager.js';
import { AppletManager, VolumeApplet, ClockApplet, SpacerApplet, ScreenshotApplet, WeatherApplet, SidePanelApplet, AdBlockerApplet, WallpaperApplet } from './core/AppletManager.js';
import WidgetManager from './core/WidgetManager.js';
import StartMenu from './core/StartMenu.js';
import ModuleViewer from './core/ModuleViewer.js';
import WebAppViewer from './core/WebAppViewer.js';
import AppletSettings from './core/AppletSettings.js';
import DockSettings from './core/DockSettings.js';
import ControlPanel from './core/ControlPanel.js';
import HeavySitesSettings from './core/HeavySitesSettings.js';

import NewBrowser from './features/apps/NewBrowser.js';
import ImmersiveBrowser from './features/apps/ImmersiveBrowser.js';

import TerminalManager from './features/apps/TerminalManager.js';


let blockCount = 0;


async function initializeApp() {
    try {
        console.log('Initializing app...');

        // Initialize managers with error checking
        console.log('Creating WindowManager...');
        const windowManager = new WindowManager();
        if (!windowManager) throw new Error('Failed to create WindowManager');

        console.log('Creating DockManager...');
        const dockManager = new DockManager(false);
        if (!dockManager) throw new Error('Failed to create DockManager');

        // Ensure dock is initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('DockManager initialized');


        // initilize ControlPanel with logging
        console.log('Creating ControlPanel...');
        const controlPanel = new ControlPanel();
        window.controlPanel = controlPanel;
        

        // Initialize AppletManager with logging
        console.log('Creating AppletManager...');
        const appletManager = new AppletManager(dockManager);
        if (!appletManager) throw new Error('Failed to create AppletManager');

        // Initialize AppletSettings
        console.log('Creating AppletSettings...');
        const appletSettings = new AppletSettings(appletManager);
        window.appletSettings = appletSettings;

        // initilize DockSettings
        console.log('Creating DockSettings...');
        const dockSettings = new DockSettings(windowManager);
        window.dockSettings = dockSettings;

        // initilize DockSettings
        console.log('Creating HeavSiteSettings...');
        const heavySitesSettings = new HeavySitesSettings(windowManager);
        window.heavySitesSettings = heavySitesSettings;

        // Initialize other managers with checks
        console.log('Creating WidgetManager...');
        const widgetManager = new WidgetManager();
        window.widgetManager = widgetManager;

        console.log('Creating ModuleViewer...');
        const moduleViewer = new ModuleViewer(windowManager);
        window.moduleViewer = moduleViewer;

        console.log('Creating WebAppViewer...');
        const webAppViewer = new WebAppViewer(windowManager);
        window.webAppViewer = webAppViewer;

        // Initialize system apps
        console.log('Initializing system apps...');
        const terminalManager = new TerminalManager(windowManager);
        const newBrowser = new NewBrowser(windowManager);
        window.immersiveBrowser = new ImmersiveBrowser(windowManager); // Make it globally available

        // Connect managers
        console.log('Connecting managers...');
        windowManager.setDockManager(dockManager);

        console.log('Setting up dock items...');
        // Your dock items setup here

        console.log('App initialization complete');


        dockManager.addItem('start', {
            id: 'start-menu',
            title: 'Start',
            icon: 'apps',
            showTitle: false,
            isPinned: true,
            onClick: async () => {
                if (!window.startMenu) {
                    window.startMenu = new StartMenu();
                    await window.startMenu.init();
                }
                window.startMenu.toggle();
            }
        });

        // dockManager.addItem('system', {
        //     id: 'applet-settings',
        //     title: 'Applet Settings',
        //     icon: 'tune',
        //     showTitle: false,
        //     isPinned: true,
        //     onClick: () => {
        //         if (window.appletSettings) {
        //             window.appletSettings.show();
        //         }
        //     }
        // });

        // dockManager.addItem('system', {
        //     id: 'dock-settings',
        //     title: 'Dock Settings',
        //     icon: 'dock_to_bottom',
        //     showTitle: false,
        //     isPinned: true,
        //     onClick: () => {
        //         if (window.dockSettings) {
        //             window.dockSettings.show();
        //         }
        //     }
        // });

        // dockManager.addItem('system', {
        //     id: 'heavy-sites-settings',
        //     title: 'Heavy Sites Manager',
        //     icon: 'speed',  // or 'memory' or 'tune'
        //     showTitle: false,
        //     isPinned: true,
        //     onClick: () => {
        //         if (!window.heavySitesSettings) {
        //             window.heavySitesSettings = new HeavySitesSettings();
        //         }
        //         window.heavySitesSettings.show();
        //     }
        // });

                // Update dock items
        dockManager.addItem('system', {
            id: 'control-panel',
            title: 'Settings',
            icon: 'settings',
            showTitle: false,
            isPinned: true,
            onClick: () => {
                if (!window.controlPanel) {
                    window.controlPanel = new ControlPanel();
                }
                window.controlPanel.show();
            }
        });


        dockManager.addItem('apps', {
            id: 'terminal',
            title: 'Terminal',
            icon: await window.electronAPI.getPlatform() === 'win32' ? 'terminal' : 'code',
            showTitle: false,
            isPinned: true,
            onClick: async () => {
                try {
                    // Show loading state
                    const loadingToast = document.createElement('sl-alert');
                    loadingToast.variant = 'primary';
                    loadingToast.innerHTML = `
                        <sl-spinner></sl-spinner>
                        Starting terminal...
                    `;
                    loadingToast.duration = 3000; // 3 seconds
                    document.body.appendChild(loadingToast);
                    loadingToast.toast();
        
                    await terminalManager.createTerminalWindow();
        
                    // Show success message
                    const successToast = document.createElement('sl-alert');
                    successToast.variant = 'success';
                    successToast.innerHTML = 'Terminal started successfully';
                    successToast.duration = 3000;
                    document.body.appendChild(successToast);
                    successToast.toast();
        
                } catch (error) {
                    // Show error in UI
                    const errorToast = document.createElement('sl-alert');
                    errorToast.variant = 'danger';
                    errorToast.innerHTML = `Terminal Error: ${error.message}`;
                    errorToast.duration = 3000;
                    document.body.appendChild(errorToast);
                    errorToast.toast();
                    
                    console.error('Error creating terminal window:', error);
                }
            }
        });


        dockManager.addItem('apps', {
            id: 'new-browser',
            title: 'New Browser',
            icon: 'language',
            showTitle: false,
            isPinned: true,
            onClick: async () => {
                try {
                    await newBrowser.createBrowserWindow(); // Using the instance instead of the class
                } catch (error) {
                    console.error('Error creating browser window:', error);
                }
            }
        });

        dockManager.addItem('apps', {
            id: 'immersive-browser',
            title: 'Immersive Browser',
            icon: 'circle',
            showTitle: false,
            isPinned: true,
            onClick: async () => {
                try {
                    await window.immersiveBrowser.createBrowserWindow();
                } catch (error) {
                    console.error('Error creating immersive browser window:', error);
                }
            }
        });


        console.log('Registering applets...');
        // Register built-in applets
        appletManager.registerApplet('volume', VolumeApplet);
        appletManager.registerApplet('clock', ClockApplet);
        appletManager.registerApplet('spacer', SpacerApplet);
        appletManager.registerApplet('screenshot', ScreenshotApplet);
        appletManager.registerApplet('weather', WeatherApplet);
        appletManager.registerApplet('panel', SidePanelApplet);
        appletManager.registerApplet('adblocker', AdBlockerApplet);
        appletManager.registerApplet('wallpaper', WallpaperApplet);


        // deafult applets are now handled by AppletSettings and AppletManager

        window.electronAPI.browser.adBlocker.onCountUpdate((count) => {
            blockCount = count;
            // If newBrowser instance exists, update its counter
            if (window.newBrowser) {
                const event = new CustomEvent('adblock-count-updated', { detail: count });
                window.dispatchEvent(event);
            }
        });

    } catch (error) {
        console.error('Failed to initialize app:', error);
        // Display error visually
        document.body.innerHTML = `
            <div style="padding: 20px; color: red;">
                Failed to initialize app: ${error.message}
            </div>
        `;
    }
}

// Ensure DOM is loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(error => {
        console.error('Critical initialization error:', error);
    });
});
