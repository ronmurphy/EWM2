const { app, BrowserWindow, globalShortcut, ipcMain, screen, session, Menu, dialog, shell } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const si = require('systeminformation');
const { spawn } = require("child_process");
const loudness = require('loudness');

const { readFileSync, writeFileSync } = require("original-fs");

const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const screenshot = require('screenshot-desktop');



let store;
let mainWindow;
let blocker;
let isBlockingEnabled = true;
let blockCount = 0;
let terminalProcess = null;
let powershell = null;
let shellProcess = null;


// const API_KEY = 'a6bff040c6e2fd318bdd52c7a6afae94';

const WEATHER_API_KEY = 'a6bff040c6e2fd318bdd52c7a6afae94';

// const fs = require('fs');

async function initializeStore() {
    const Store = await import('electron-store');
    store = new Store.default();
}

// store.set('weatherCity', 'New York'); // Set default city if not exists

async function initializeBlocker() {
    try {
        // Make sure we wait for the session to be ready
        blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
        await blocker.enableBlockingInSession(session.defaultSession);

        //   console.log('blocker:>',blocker);
        
        blocker.on('request-blocked', (request) => {
            if (isBlockingEnabled && mainWindow && !mainWindow.isDestroyed()) {
                blockCount++;
                console.log(`Blocked request to: ${request.url}`);
                console.log(`Block count updated to: ${blockCount}`);
                try {
                    mainWindow.webContents.send('update-block-count', blockCount);
                    console.log('Count sent to window');
                } catch (error) {
                    console.error('Error sending count:', error);
                }
            }
        });

        console.log('Ad blocker initialized and enabled');
    } catch (error) {
        console.error('Failed to initialize ad blocker:', error);
    }
}

ipcMain.handle('initialize-browser-blocker', async (event) => {
    try {
        console.log('Initializing browser ad blocker...');
        const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
        console.log('Browser ad blocker initialized');
        return true;
    } catch (error) {
        console.error('Error initializing browser blocker:', error);
        return false;
    }
});


// main.js - Update path resolution
ipcMain.handle('read-file', async (_, filePath) => {
    try {
        const fullPath = path.resolve(__dirname, filePath);
        console.log('Reading file from:', fullPath);
        
        // Check permissions first
        await fs.access(fullPath, fs.constants.R_OK);
        const content = await fs.readFile(fullPath, 'utf8');
        return content;
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
});


ipcMain.handle('get-system-volume', async () => {
    return audio.get();
});

ipcMain.handle('set-system-volume', async (_, volume) => {
    audio.set(volume);
    return audio.get();
});

ipcMain.handle('write-file', async (event, { filePath, data, options }) => {
    try {
        const fullPath = path.resolve(filePath);
        const dir = path.dirname(fullPath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(dir, { recursive: true });
        
        // Handle different data types
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
        
        // Write with proper permissions (644 for Linux, default for Windows)
        const writeOptions = {
            ...options,
            mode: process.platform === 'linux' ? 0o644 : undefined
        };
        
        await fs.writeFile(fullPath, buffer, writeOptions);
        return true;
    } catch (error) {
        console.error('File write error:', error);
        throw error;
    }
});

ipcMain.handle('show-save-dialog', async () => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `screenshot-${Date.now()}.png`,
            filters: [{ name: 'Images', extensions: ['png'] }]
        });
        return result;
    } catch (error) {
        console.error('Save dialog error:', error);
        throw error;
    }
});

ipcMain.handle('read-blocker-file', async (event, path) => {
    try {
        return await fs.readFile(path);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('write-blocker-file', async (event, path, data) => {
    try {
        await fs.writeFile(path, data);
        return true;
    } catch (error) {
        throw error;
    }
});

function createWindow() {
    if (!mainWindow) {
        mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: true
        },
        frame: false,
        fullscreen: true,
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });



}
globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow.webContents.send('capture-screenshot');
});

}




// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {

        await initializeBlocker();
        await initializeStore();
        createWindow();


        // Add app event listeners here, inside whenReady
        app.on('activate', async function () {
            if (BrowserWindow.getAllWindows().length === 0) {
                await initializeBlocker();
                createWindow();
            }
        });

        // Clean up terminal process on app quit
        app.on("before-quit", () => {
            if (shellProcess) shellProcess.kill();
        });

        // Add any other app.on listeners here as well
    });
}

ipcMain.handle('getPlatform', () => {
    return process.platform;
});

function startShell() {
    const platform = process.platform;
    if (platform === 'win32') {
        shellProcess = spawn('powershell.exe', ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "-"], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } else {
        shellProcess = spawn(process.env.SHELL || '/bin/bash', [], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }

    shellProcess.stdin.setDefaultEncoding('utf-8');
    shellProcess.stdout.on("data", (data) => {
        if (mainWindow) {
            mainWindow.webContents.send("command-output", data.toString());
        }
    });
    shellProcess.stderr.on("data", (data) => {
        if (mainWindow) {
            mainWindow.webContents.send("command-output", `Error: ${data.toString()}`);
        }
    });
    shellProcess.on("exit", () => {
        shellProcess = null;
    });
}

// function startPowershell() {
//     if (!powershell) {
//         powershell = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "-"]);
//         powershell.stdin.setDefaultEncoding('utf-8');

//         powershell.stdout.on("data", (data) => {
//             if (mainWindow) {
//                 mainWindow.webContents.send("command-output", data.toString());
//             }
//         });

//         powershell.stderr.on("data", (data) => {
//             if (mainWindow) {
//                 mainWindow.webContents.send("command-output", `Error: ${data.toString()}`);
//             }
//         });

//         powershell.on("exit", () => {
//             powershell = null;
//         });
//     }
// }

// ipcMain.handle('spawn-terminal', async (event, command) => {
//     return new Promise((resolve, reject) => {
//         const terminal = spawn(command, [], {
//             shell: true,
//             stdio: 'inherit'
//         });
//         terminal.on('error', reject);
//         terminal.on('exit', resolve);
//     });
// });

ipcMain.handle('spawn-terminal', async (event, command) => {
    return new Promise((resolve, reject) => {
        const terminal = spawn(command, [], {
            shell: true,
            stdio: 'inherit',
            env: process.env
        });
        terminal.on('error', reject);
        terminal.on('exit', resolve);
    });
});

ipcMain.handle('send-command', async (event, command) => {
    console.log('Received command:', command);
    try {
        if (!shellProcess) startShell();
        shellProcess.stdin.write(command + '\n');
        return `> ${command}\n`;
    } catch (error) {
        console.error('Command error:', error);
        return `Error: ${error.message}`;
    }
});

ipcMain.handle('show-prompt', async (event, title, defaultValue) => {
    const result = await dialog.showMessageBox(mainWindow, {
        title: title,
        message: 'Enter URL:',
        defaultId: 0,
        buttons: ['OK', 'Cancel'],
        type: 'question',
        inputField: defaultValue
    });
    
    if (result.response === 0) {
        return result.inputValue;
    }
    return null;
});

// Keep send-unix-command for legacy support but route through send-command
ipcMain.handle('send-unix-command', async (event, command) => {
    return ipcMain.handle('send-command', event, command);
});


// Handle webview blocking enable request
ipcMain.handle('enable-blocking', async (event, webContentsId) => {
    if (blocker) {
        const contents = webContents.fromId(webContentsId);
        if (contents) {
            blocker.enableBlockingInWebView(contents);
            // Reset stats for this webContents
            blockStats.set(webContentsId, 0);
        }
    }
});

// Handle toggle blocking
ipcMain.handle('toggle-blocking', async () => {
    isBlockingEnabled = !isBlockingEnabled;
    
    if (isBlockingEnabled) {
        await blocker.enableBlockingInSession(session.defaultSession);
    } else {
        await blocker.disableBlockingInSession(session.defaultSession);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('blocking-state-changed', {
            enabled: isBlockingEnabled,
            count: blockCount
        });
    }

    return isBlockingEnabled;
});

ipcMain.handle('get-temp-path', () => {
    const tempDir = path.join(os.tmpdir(), 'ewm-temp');
    // Ensure proper path separators for current platform
    return path.normalize(tempDir);
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// Basic IPC handlers
ipcMain.handle('store:get', async (event, key) => {
    return store.get(key);
});

ipcMain.handle('store:set', async (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('store:delete', async (event, key) => {
    store.delete(key);
    return true;
});

// Add these IPC handlers after your existing ones
ipcMain.handle('browser-process-url', async (event, url) => {
    // Handle search terms vs URLs
    if (!url.includes('.') || url.includes(' ')) {
        return `https://duckduckgo.com/?q=${encodeURIComponent(url)}`;
    }
    if (!url.startsWith('http')) {
        return `https://${url}`;
    }
    return url;
});

ipcMain.handle('browser-permission-request', async (event, permission) => {
    const webContents = event.sender;
    const result = await new Promise((resolve) => {
        mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(true); // For now, allow all permissions
            resolve(true);
        });
    });
    return result;
});

ipcMain.handle('screenshot-fullscreen', async () => {
    console.log('Main: Handling IPC screenshot-fullscreen request');
    try {
        // Capture the screenshot
        const buffer = await screenshot({ format: 'png' });
        return buffer.toString('base64');
    } catch (error) {
        console.error('Fullscreen screenshot failed in main:', error);
        throw error;
    }
});


ipcMain.handle('screenshot-window', async () => {
    console.log('Main: Handling IPC active screenshot-window request');
    try {
        // For now, we'll use full screen until we implement window selection
        const buffer = await screenshot();
        console.log('Window screenshot captured, converting to base64');
        return buffer.toString('base64');
    } catch (error) {
        console.error('Window screenshot failed in main:', error);
        throw error;
    }
});

ipcMain.handle('screenshot-selection', async () => {
    console.log('Main: Handling IPC screenshot-selection request');
    try {
        // For now, use full screen until we implement area selection
        const buffer = await screenshot();
        console.log('Selection screenshot captured, converting to base64');
        return buffer.toString('base64');
    } catch (error) {
        console.error('Selection screenshot failed in main:', error);
        throw error;
    }
});

// Add new IPC handler for screenshots
ipcMain.handle('write-screenshot-file', async (event, { filePath, data }) => {
    try {
        const buffer = Buffer.from(data, 'base64');
        await fs.writeFile(filePath, buffer);
        return { success: true, path: filePath };
    } catch (error) {
        console.error('Screenshot save error:', error);
        throw error;
    }
});

// IPC Handlers
ipcMain.handle('get-system-info', async () => {
    try {
        const [system, os, cpu, memory, graphics, disk, fsSize, network, battery] = await Promise.all([
            si.system(),
            si.osInfo(),
            si.cpu(),
            si.mem(),
            si.graphics(),
            si.diskLayout(),
            si.fsSize(),
            si.networkInterfaces(),
            si.battery()
        ]);

        return {
            system,
            os,
            cpu,
            memory,
            graphics,
            disk,
            fsSize,
            network,
            battery,
            uptime: os.uptime
        };
    } catch (error) {
        console.error('Error getting system info:', error);
        return null;
    }
});

ipcMain.handle('get-system-stats', async () => {
    try {
        const [currentLoad, mem] = await Promise.all([
            si.currentLoad(),
            si.mem()
        ]);

        return {
            cpu: currentLoad.currentLoad,
            memory: (mem.used / mem.total) * 100
        };
    } catch (error) {
        console.error('Error getting system stats:', error);
        return {
            cpu: 0,
            memory: 0
        };
    }
});


ipcMain.handle('system:getStats', async () => {
    try {
        const [currentLoad, mem, processes, temp, time] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.processes(),
            si.cpuTemperature(),
            si.time()
        ]);
        
        const cpuInfo = await si.cpu();
        
        return {
            cpu: currentLoad.currentLoad,
            memory: (mem.used / mem.total) * 100,
            cpuDetails: {
                speed: cpuInfo.speed,
                cores: os.cpus().length,
                temp: temp.main || null,
                threads: cpuInfo.processors
            },
            memoryDetails: {
                total: mem.total,
                used: mem.used,
                cached: mem.cached || 0,
                available: mem.available,
                swapused: mem.swapused,
                swaptotal: mem.swaptotal
            },
            processCount: processes.all,
            threadCount: processes.threads,
            loadAverage: os.loadavg(),  // Returns array on Linux, number on Windows
            uptime: os.uptime(),
            time: {
                uptime: time.uptime,
                timezone: time.timezone,
                timezoneName: time.timezoneName
            }
        };
    } catch (error) {
        console.error('Error getting system stats:', error);
        throw error;
    }
});

ipcMain.handle('get-weather', async (_, city) => {
    try {
        // Current weather
        const currentResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}`
        );
        const currentData = await currentResponse.json();
        
        // 3-day forecast
        const forecastResponse = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${WEATHER_API_KEY}`
        );
        const forecastData = await forecastResponse.json();

        // Get unit preference
        const unit = await store.get('weatherUnit') || 'C';
        const temp = currentData.main.temp;
        
        // Convert temperature based on unit
        const convertedTemp = unit === 'C' ? 
            Math.round(temp - 273.15) : 
            Math.round((temp - 273.15) * 9/5 + 32);

        // Get next 3 days forecast
        const forecast = forecastData.list
            .filter((item, index) => index % 8 === 0)
            .slice(0, 3)
            .map(day => ({
                date: new Date(day.dt * 1000).toLocaleDateString(),
                temp: unit === 'C' ? 
                    Math.round(day.main.temp - 273.15) : 
                    Math.round((day.main.temp - 273.15) * 9/5 + 32),
                icon: day.weather[0].icon,
                description: day.weather[0].description
            }));

        return {
            temp: convertedTemp,
            unit,
            icon: currentData.weather[0].icon,
            description: currentData.weather[0].description,
            city,
            forecast
        };
    } catch (error) {
        console.error('Weather API error:', error);
        throw error;
    }
});

// ipcMain.handle('app-restart', () => {
//     app.relaunch();
//     app.exit();
// });

// ipcMain.handle('app-exit', () => {
//     app.quit();
// });

ipcMain.handle('cleanup-windows', () => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        win.webContents.send('cleanup-windows');
    });
});

ipcMain.handle('app-restart', () => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('cleanup-windows');
    });
    app.relaunch();
    app.exit();
});

ipcMain.handle('app-exit', () => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('cleanup-windows');
    });
    app.quit();
});

// DevTools toggle
ipcMain.on('toggle-dev-tools', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        window.webContents.toggleDevTools();
    }
});

// ipcMain.on('app-shutdown', () => {
//     app.quit();
// });

ipcMain.handle('get-memory-usage', async () => {
    const mem = process.getProcessMemoryInfo();
    return {
        total: mem.workingSetSize,
        percentUsed: (mem.workingSetSize / os.totalmem()) * 100
    };
});

ipcMain.on('app-restart', () => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows.forEach(win => win.close());
    }
    app.relaunch();
    app.exit();
});



ipcMain.handle('open-file-dialog', async (event, options = {}) => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options.filters || [
            { name: 'All Files', extensions: ['*'] }
        ],
        title: options.title || 'Open File',
        defaultPath: options.defaultPath ? path.normalize(options.defaultPath) : undefined,
        buttonLabel: options.buttonLabel || 'Open'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return path.normalize(result.filePaths[0]);
    }
    return null;
});

ipcMain.handle('save-file-dialog', async (event, content) => {
    try {
        const result = await dialog.showSaveDialog({
            filters: [
                { name: 'Text Files', extensions: ['txt'] }
            ]
        });

        if (!result.canceled) {
            const normalizedPath = path.normalize(result.filePath);
            await fs.writeFile(normalizedPath, content, {
                encoding: 'utf8',
                mode: process.platform === 'linux' ? 0o644 : undefined
            });
            return {
                path: normalizedPath,
                success: true
            };
        }
        return { success: false };
    } catch (error) {
        console.error('Error in save-file-dialog:', error);
        throw error;
    }
});

// Wallpaper handling
ipcMain.handle('set-wallpaper', async (event, url) => {
    console.log('Main process: setting wallpaper to:', url);
    try {
        // Check if it's a local file path
        if (url.startsWith('file://')) {
            // Convert URL to proper file path format
            const filePath = url.replace('file:///', '').split('/').join(path.sep);
            console.log('Converted file path:', filePath);

            // Check if file exists
            try {
                await fs.access(filePath);
                // File exists, create proper file URL
                const properUrl = `file:///${filePath.split(path.sep).join('/')}`;
                console.log('Proper file URL:', properUrl);

                await mainWindow.webContents.executeJavaScript(`
                    document.body.style.backgroundImage = "url('${properUrl}')";
                    document.body.style.backgroundSize = "cover";
                    document.body.style.backgroundPosition = "center";
                    document.body.style.backgroundRepeat = "no-repeat";
                `);
                return { success: true };
            } catch (error) {
                console.error('File not found:', filePath);
                throw new Error(`File not found: ${filePath}`);
            }
        } else {
            // Handle web URLs normally
            await mainWindow.webContents.executeJavaScript(`
                document.body.style.backgroundImage = "url('${url}')";
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundPosition = "center";
                document.body.style.backgroundRepeat = "no-repeat";
            `);
            return { success: true };
        }
    } catch (error) {
        console.error('Error setting wallpaper:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-last-wallpaper', async (event, url) => {
    if (!store) return false;
    store.set('lastWallpaper', url);
    return true;
});


// Add debug logging
ipcMain.handle('scan-widgets', async () => {
    console.log('Main: scan-widgets handler called');
    try {
        const widgetsPath = path.join(__dirname, 'features', 'modules');
        console.log('Absolute path being scanned:', path.resolve(widgetsPath));
    
        // const widgetsPath = path.join(__dirname, 'features', 'modules');
        console.log('Scanning directory:', widgetsPath);
        const folders = await fs.readdir(widgetsPath, { withFileTypes: true });
        const widgetFolders = folders
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        console.log('Found modules:', widgetFolders);
        return widgetFolders;
    } catch (error) {
        console.error('Main: Error scanning modules:', error);
        return [];
    }
});

ipcMain.handle('read-widget-info', async (_, folder) => {
    console.log('Main: read-widget-info handler called for folder:', folder);
    try {
        const infoPath = path.join(__dirname, 'features', 'modules', folder, 'widget.json');
        console.log('Reading module info from:', infoPath);
        const content = await fs.readFile(infoPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Main: Error reading module info:', error);
        return null;
    }
});