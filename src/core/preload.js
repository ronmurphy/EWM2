const { contextBridge, ipcRenderer } = require('electron');
const loudness = require('loudness');

contextBridge.exposeInMainWorld(
    'electronAPI',
    {
        platform: process.platform,
        getPlatform: () => process.platform,
        spawnTerminal: (command) => ipcRenderer.invoke('spawn-terminal', command),

        // Terminal operations - platform aware
        sendCommand: (command) => {
            console.log('Preload: sending command:', command);
            return process.platform === 'win32'
                ? ipcRenderer.invoke('send-command', command)
                : ipcRenderer.invoke('send-unix-command', command);
        },
        sendUnixCommand: (command) => ipcRenderer.invoke('send-unix-command', command),
        onCommandOutput: (callback) => {
            console.log('Preload: setting up command output listener');
            return ipcRenderer.on('command-output', (_event, data) => callback(data));
        },

        sendUnixCommand: (command) => ipcRenderer.invoke('send-unix-command', command),

        // Specific screenshot file writer
        writeScreenshotFile: async (filePath, data) => {
            return await ipcRenderer.invoke('write-screenshot-file', { 
                filePath, 
                data 
            });
        },

        // Generic file writer
        writeFile: (filePath, data, options = {}) => {
            console.log('Writing file:', filePath);
            return ipcRenderer.invoke('write-file', {
                filePath,
                data,
                options
            });
        },

        restartApp: () => ipcRenderer.invoke('app-restart'),
        exitApp: () => ipcRenderer.invoke('app-exit'),
        cleanupWindows: () => ipcRenderer.invoke('cleanup-windows'),
        getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),


        toggleDevTools: () => ipcRenderer.send('toggle-dev-tools'),
        writeFile: (filePath, data, options) =>
            ipcRenderer.invoke('write-file', { filePath, data, options }),
        getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
        initializeBlocker: () => {
            console.log('Invoking initialize-browser-blocker');
            return ipcRenderer.invoke('initialize-browser-blocker');
        },
        showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
        captureFullScreen: (savePath) => {
            console.log('Preload: Requesting fullscreen screenshot with path:', savePath);
            return ipcRenderer.invoke('screenshot-fullscreen', savePath);
        },

        showPrompt: async (title, defaultValue) => {
            return ipcRenderer.invoke('show-prompt', title, defaultValue);
        },

        captureActiveWindow: () => {
            console.log('Preload: Requesting active window screenshot');
            return ipcRenderer.invoke('screenshot-window');
        },
        captureSelection: () => {
            console.log('Preload: Requesting selection screenshot');
            return ipcRenderer.invoke('screenshot-selection');
        },

        blockerFS: {
            readFile: (path) => ipcRenderer.invoke('read-blocker-file', path),
            writeFile: (path, data) => ipcRenderer.invoke('write-blocker-file', path, data)
        },


        // getWeather: (city) => ipcRenderer.invoke('get-weather', city),
        getWeather: (city) => ipcRenderer.invoke('get-weather', city),

        // Store operations
        store: {
            get: (key) => ipcRenderer.invoke('store:get', key),
            set: (key, value) => ipcRenderer.invoke('store:set', key, value),
            delete: (key) => ipcRenderer.invoke('store:delete', key)
        },

        system: {
            getStats: () => ipcRenderer.invoke('get-system-stats')
        },
        system: {
            getStats: () => ipcRenderer.invoke('system:getStats')
        },

        // Window operations
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close'),

        // Event handling
        on: (channel, callback) => {
            const validChannels = ['window-state-change', 'theme-changed'];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => callback(...args));
            }
        },

        removeListener: (channel, callback) => {
            const validChannels = ['window-state-change', 'theme-changed'];
            if (validChannels.includes(channel)) {
                ipcRenderer.removeListener(channel, callback);
            }
        },

        // imported from old preload.js
        setWallpaper: (url) => {
            console.log('Preload: sending set-wallpaper with URL:', url);
            return ipcRenderer.invoke('set-wallpaper', url);
        },
        getDisplays: () => ipcRenderer.invoke('get-displays'),
        captureScreen: (bounds) => ipcRenderer.invoke('capture-screen', bounds),
        captureScreenshot: () => ipcRenderer.send('capture-screenshot'),
        onCaptureScreenshot: (callback) => ipcRenderer.on('capture-screenshot', callback),
        takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
        getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),
        getProcessInfo: () => ipcRenderer.invoke('get-process-info'),
        testPath: (path) => ipcRenderer.invoke('test-path', path),
        testFS: () => ipcRenderer.invoke('test-fs'),
        openFile: (path) => ipcRenderer.invoke('open-file', path),
        openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
        getTempPath: () => ipcRenderer.invoke('get-temp-path'),

        // writeFile: async (filePath, content) => {
        //     try {
        //         return await ipcRenderer.invoke('write-file', filePath, content);
        //     } catch (error) {
        //         console.error('Error writing file:', error);
        //         throw error;
        //     }
        // },
        // Dialog operations
        saveFileDialog: async (options) => {
            try {
                return await ipcRenderer.invoke('save-file-dialog', options);
            } catch (error) {
                console.error('Error in save dialog:', error);
                throw error;
            }
        },
        // Path operations
        resolveFilePath: (filePath) => {
            try {
                return path.resolve(filePath);
            } catch (error) {
                console.error('Error resolving path:', error);
                throw error;
            }
        },
        getDirname: (filePath) => {
            try {
                return path.dirname(filePath);
            } catch (error) {
                console.error('Error getting dirname:', error);
                throw error;
            }
        },

        // ... startmenu code
        scanWidgets: () => {
            console.log('Preload: calling scan-widgets');
            return ipcRenderer.invoke('scan-widgets');
        },
        readWidgetInfo: (folder) => {
            console.log('Preload: calling read-widget-info for folder:', folder);
            return ipcRenderer.invoke('read-widget-info', folder);
        },


        files: {
            // New grouped methods
            readFile: async (filePath) => {
                const normalizedPath = path.normalize(filePath);
                return ipcRenderer.invoke('read-file', normalizedPath);
            },
            writeFile: async (filePath, data, options = {}) => {
                const normalizedPath = path.normalize(filePath);
                return ipcRenderer.invoke('write-file', {
                    filePath: normalizedPath,
                    data,
                    options
                });
            },
            openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
            saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),
            getTempPath: () => ipcRenderer.invoke('get-temp-path')
        },

        // Keep existing methods for backward compatibility
        readFile: async (filePath) => {
            console.log('preload: readFile called with path:', filePath);
            try {
                const result = await ipcRenderer.invoke('read-file', filePath);
                console.log('preload: readFile result length:', result?.length);
                return result;
            } catch (error) {
                console.error('preload: readFile error:', error);
                throw error;
            }
        },
        // writeFile: (filePath, data, options) =>
        //     ipcRenderer.invoke('write-file', { filePath, data, options }),
        openFile: (path) => ipcRenderer.invoke('open-file', path),

        // Cross-platform audio
        audio: {
            async getVolume() {
                try {
                    return await loudness.getVolume();
                } catch (error) {
                    console.error('Failed to get volume:', error);
                    return 0;
                }
            },
            async setVolume(value) {
                try {
                    await loudness.setVolume(value);
                } catch (error) {
                    console.error('Failed to set volume:', error);
                }
            }
        },
        // readFile: (filePath) => {
        //     console.log('Attempting to read file:', filePath);
        //     return ipcRenderer.invoke('read-file', filePath);
        // },

        readFile: async (filePath) => {
            console.log('preload: readFile called with path:', filePath);
            try {
                const result = await ipcRenderer.invoke('read-file', filePath);
                console.log('preload: readFile result length:', result?.length);
                return result;
            } catch (error) {
                console.error('preload: readFile error:', error);
                throw error;
            }
        },
        openFile: (options) => {
            console.log('Attempting to open file dialog with options:', options);
            return ipcRenderer.invoke('open-file-dialog', options);
        },

        // files: {
        //     readFile: (path) => ipcRenderer.invoke('read-file', path)
        // },

        //newbrowser.js
        browser: {
            initializeBlocker: () => ipcRenderer.invoke('initialize-browser-blocker'),
            navigate: (url) => ipcRenderer.invoke('browser-navigate', url),
            createTab: () => ipcRenderer.invoke('browser-create-tab'),
            closeTab: (tabId) => ipcRenderer.invoke('browser-close-tab', tabId),
            download: (url) => ipcRenderer.invoke('browser-download', url),
            requestPermission: (permission) => ipcRenderer.invoke('browser-permission-request', permission),
            maximizeBrowser: (windowId) => ipcRenderer.invoke('browser-maximize', windowId),
            minimizeBrowser: (windowId) => ipcRenderer.invoke('browser-minimize', windowId),
            processUrl: (url) => ipcRenderer.invoke('browser-process-url', url),


            adBlocker: {
                enable: (webContentsId) => ipcRenderer.invoke('enable-blocking', webContentsId),
                disable: (webContentsId) => ipcRenderer.invoke('disable-blocking', webContentsId),
                toggle: () => ipcRenderer.invoke('toggle-blocking'),
                onCountUpdate: (callback) => {
                    console.log('Registering block count listener');
                    ipcRenderer.on('update-block-count', (_event, value) => callback(value));
                },
                onStateChange: (callback) => {
                    ipcRenderer.on('blocking-state-changed', (_event, state) => callback(state));
                }
            }
        },


    }
);

ipcRenderer.on('cleanup-windows', () => {
    if (window.windowManager) {
        window.windowManager.dispose();
    }
});