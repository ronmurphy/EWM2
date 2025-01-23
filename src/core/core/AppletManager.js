// Template for future references
// const AppletTemplate = {
//     name: 'Applet Name',
    
//     async createInstance(id) {
//         console.log(`Creating ${this.name} instance`);
        
//         // Create main container
//         const container = document.createElement('div');
//         container.className = 'applet-name-container';
        
//         // Add icon if needed
//         if (this.needsIcon) {
//             const iconPart = document.createElement('span');
//             iconPart.className = 'material-symbols-outlined';
//             iconPart.textContent = 'icon_name';
//             container.appendChild(iconPart);
//         }
        
//         // Add main content
//         const contentPart = document.createElement('div');
//         contentPart.className = 'applet-name-content';
//         container.appendChild(contentPart);
        
//         // Add event listeners
//         container.addEventListener('event', (e) => {
//             // Handle events
//         });

//         return {
//             id,
//             customContent: container,
//             // Optional destroy method for cleanup
//             destroy() {
//                 // Cleanup code
//             }
//         };
//     }
// };

// /* Container for applets that need both icon and content */
// .applet-name-container {
//     display: flex;
//     align-items: center;
//     gap: 8px;
//     padding: 0 8px;
// }

// /* Icon styling */
// .applet-name-container .material-symbols-outlined {
//     color: white;
//     font-size: 20px;
// }

// /* Main content styling */
// .applet-name-content {
//     /* Specific styling for the applet content */
// }


class AppletManager {
    constructor(dockManager) {
        this.dockManager = dockManager;
        this.applets = new Map();
        this.registeredTypes = new Map();
        this.settings = null;
        
        // Load saved settings on init
        this.loadSavedSettings();
    }

    clearApplets() {
        // Remove all current applets
        for (const [id, applet] of this.applets.entries()) {
            this.removeApplet(id);
        }
        this.applets.clear();
    }

    registerApplet(type, config) {
        console.log(`Registering applet type: ${type}`);
        this.registeredTypes.set(type, {
            name: config.name,
            icon: config.icon,
            description: config.description,
            createInstance: config.createInstance
        });
    }

    async createApplet(type) {
        console.log(`Creating applet of type: ${type}`);
        
        const appletConfig = this.registeredTypes.get(type);
        if (!appletConfig) {
            console.warn(`No applet configuration found for type: ${type}`);
            return null;
        }
    
        const id = `applet-${Date.now()}`;
        const applet = await appletConfig.createInstance(id);
        
        console.log(`Applet instance created for ${type}:`, applet);
        
        this.applets.set(id, applet);
    
        // Add to dock's system tray with just the custom content
        this.dockManager.addItem('tray', {
            id,
            customContent: applet.customContent,
            isApplet: true
        });
    
        return applet;
    }

    removeApplet(id) {
        const applet = this.applets.get(id);
        if (applet) {
            applet.destroy?.();
            this.applets.delete(id);
        }
    }

    // New methods for applet settings
    getRegisteredApplets() {
        return this.registeredTypes;
    }

    showSettings() {
        if (window.appletSettings) {
            window.appletSettings.show();
        }
    }

    async saveSettings(settings) {
        this.settings = settings;
        await window.electronAPI.store.set('appletSettings', settings);
        await this.refreshApplets();
    }

    async refreshApplets() {
        const settings = this.settings;
        
        // Clear all existing applets first
        this.clearApplets();

        // Add applets based on settings
        const orderedSettings = Object.entries(settings)
            .filter(([_, setting]) => setting.enabled !== false)
            .sort((a, b) => a[1].order - b[1].order);

        for (const [type] of orderedSettings) {
            if (this.registeredTypes.has(type)) {
                await this.createApplet(type);
            }
        }
    }

    async loadSavedSettings() {
        this.settings = await window.electronAPI.store.get('appletSettings') || {};
        
        // Create default settings for registered applets if none exist
        if (Object.keys(this.settings).length === 0) {
            for (const [id, applet] of this.registeredTypes) {
                this.settings[id] = {
                    enabled: true,
                    order: Array.from(this.registeredTypes.keys()).indexOf(id)
                };
            }
            await window.electronAPI.store.set('appletSettings', this.settings);
        }
        
        await this.refreshApplets();
    }
}

const VolumeApplet = {
    name: 'Volume Control',
    icon: 'volume_up',
    
    async createInstance(id) {
        const container = document.createElement('div');
        container.className = 'volume-container';
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'volume-icon-wrapper';
        
        const iconPart = document.createElement('span');
        iconPart.className = 'material-symbols-outlined';
        iconPart.textContent = 'volume_up';
        
        const volumeText = document.createElement('span');
        volumeText.className = 'volume-percentage';
        
        iconWrapper.appendChild(iconPart);
        container.appendChild(iconWrapper);
        container.appendChild(volumeText);

        let lastVolume = 100; // Store last volume before mute
        let currentVolume = await window.electronAPI.audio.getVolume();
        
        const updateVolume = async (volume) => {
            currentVolume = Math.max(0, Math.min(100, volume));
            
            // Update system volume through preload API
            await window.electronAPI.audio.setVolume(currentVolume);
            
            // Update UI
            volumeText.textContent = `${currentVolume}%`;
            
            // Update icon based on volume level
            if (currentVolume === 0) {
                iconPart.textContent = 'volume_off';
            } else if (currentVolume > 0 && currentVolume <= 20) {
                iconPart.textContent = 'volume_mute';
            } else if (currentVolume > 20 && currentVolume <= 50) {
                iconPart.textContent = 'volume_down';
            } else if (currentVolume > 50 && currentVolume <= 80) {
                iconPart.textContent = 'volume_up';
            } else {
                iconPart.textContent = 'brand_awareness';
            }
        };
        
        // Initial volume display
        await updateVolume(currentVolume);
        
        // Mouse wheel control
        container.addEventListener('wheel', async (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 2 : -2;
            await updateVolume(currentVolume + delta);
        });
        
        // Click to mute/unmute
        container.addEventListener('click', async () => {
            if (currentVolume > 0) {
                lastVolume = currentVolume;
                await updateVolume(0);
            } else {
                await updateVolume(lastVolume);
            }
        });

        return { customContent: container };
    }
};

const ClockApplet = {
    name: 'Clock',
    
    async createInstance(id) {
        console.log('Creating clock applet instance');
        
        // Create main container
        const container = document.createElement('div');
        container.className = 'clock-container';
        
        
        // Add clock content
        const clockContent = document.createElement('div');
        clockContent.className = 'clock-content';
        container.appendChild(clockContent);
        
        function updateTime() {
            clockContent.textContent = new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        updateTime();
        const interval = setInterval(updateTime, 1000);
        
        return {
            id,
            customContent: container,
            destroy() {
                clearInterval(interval);
            }
        };
    }
}


// SpacerApplet definition
const SpacerApplet = {
    name: 'Spacer',
    
    async createInstance(id) {
        console.log('Creating Spacer applet instance');
        
        // Create the container
        const container = document.createElement('div');
        container.className = 'spacer-container';
        
        // Create the spacer element
        const spacer = document.createElement('div');
        spacer.className = 'spacer';
        spacer.style.width = '8px';
        
        // Create left and right resize handles
        const leftHandle = document.createElement('div');
        leftHandle.className = 'resize-handle left';
        
        const rightHandle = document.createElement('div');
        rightHandle.className = 'resize-handle right';
        
        container.appendChild(leftHandle);
        container.appendChild(spacer);
        container.appendChild(rightHandle);
        
        return {
            id,
            customContent: container,
            destroy() {
                container.remove();
            }
        };
    }
}

const ScreenshotApplet = {
    name: 'Screenshot',
    needsIcon: true,
    
    async createInstance(id) {
        const container = document.createElement('div');
        container.className = 'screenshot-container';
        
        // Create table structure
        const table = document.createElement('table');
        table.className = 'screenshot-grid';
        let currentRow;
        
        const options = [
            // {
            //     text: 'Full Screen',
            //     icon: 'fullscreen',
            //     action: async () => {
            //         try {
            //             console.log('Attempting fullscreen capture');
            //             const saveResult = await window.electronAPI.showSaveDialog({
            //                 defaultPath: `screenshot-${Date.now()}.png`,
            //                 filters: [{ name: 'PNG Image', extensions: ['png'] }]
            //             });
            //             if (!saveResult.canceled) {
            //                 const imageData = await window.electronAPI.captureFullScreen();
            //                 await window.electronAPI.writeFile({
            //                     filePath: saveResult.filePath,
            //                     data: imageData,
            //                     options: { encoding: 'base64' }
            //                 });
            //             }
            //         } catch (error) {
            //             console.error('Fullscreen capture failed:', error);
            //         }
            //     }
            // }
            {
                text: 'Full Screen',
                icon: 'fullscreen',
                action: async () => {
                    try {
                        const saveResult = await window.electronAPI.showSaveDialog({
                            defaultPath: `screenshot-${Date.now()}.png`,
                            filters: [{ name: 'PNG Images', extensions: ['png'] }]
                        });
                        
                        if (!saveResult.canceled && saveResult.filePath) {
                            const imageData = await window.electronAPI.captureFullScreen();
                            await window.electronAPI.writeScreenshotFile(
                                saveResult.filePath,
                                imageData
                            );
                        }
                    } catch (error) {
                        console.error('Screenshot failed:', error);
                    }
                }
            },
            { 
                text: 'Window',
                icon: 'crop_square',
                action: async () => {
                    try {
                        console.log('Window capture - temporarily using fullscreen');
                        const saveResult = await window.electronAPI.showSaveDialog({
                            defaultPath: `window-screenshot-${Date.now()}.png`,
                            filters: [{ name: 'PNG Image', extensions: ['png'] }]
                        });
                        if (!saveResult.canceled) {
                            // Temporarily use fullscreen capture
                            const imageData = await window.electronAPI.captureFullScreen();
                            await window.electronAPI.writeFile({
                                filePath: saveResult.filePath,
                                data: imageData,
                                options: { encoding: 'base64' }
                            });
                            console.log('Window screenshot saved to:', saveResult.filePath);
                        }
                    } catch (error) {
                        console.error('Window capture failed:', error);
                    }
                }
            },
            { 
                text: 'Selection',
                icon: 'crop',
                action: async () => {
                    try {
                        console.log('Selection capture - temporarily using fullscreen');
                        const saveResult = await window.electronAPI.showSaveDialog({
                            defaultPath: `selection-screenshot-${Date.now()}.png`,
                            filters: [{ name: 'PNG Image', extensions: ['png'] }]
                        });
                        if (!saveResult.canceled) {
                            // Temporarily use fullscreen capture
                            const imageData = await window.electronAPI.captureFullScreen();
                            await window.electronAPI.writeFile({
                                filePath: saveResult.filePath,
                                data: imageData,
                                options: { encoding: 'base64' }
                            });
                            console.log('Selection screenshot saved to:', saveResult.filePath);
                        }
                    } catch (error) {
                        console.error('Selection capture failed:', error);
                    }
                }
            },
            {
                text: 'Settings',
                icon: 'settings',
                action: () => {
                    console.log('Settings clicked');
                }
            }
        ];
        
        options.forEach((opt, index) => {
            if (index % 2 === 0) {
                currentRow = document.createElement('tr');
                table.appendChild(currentRow);
            }
            
            const cell = document.createElement('td');
            const button = document.createElement('button');
            button.className = 'screenshot-button';
            button.title = opt.text;
            
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.textContent = opt.icon;
            icon.style.fontSize = '18px';  // Smaller icons
            
            button.appendChild(icon);
            button.addEventListener('click', opt.action);
            
            cell.appendChild(button);
            currentRow.appendChild(cell);
        });
        
        container.appendChild(table);
        return {
            id,
            customContent: container,
            destroy() {
                container.remove();
            }
        };
    }
}


// Standalone function
function normalizePath(filePath) {
    return filePath.split('\\').join('/');
}

// Updated standalone function
async function setWallpaper(filePath, save = true) {
    try {
        // Convert to proper URL format without using path module
        const fileUrl = `file:///${normalizePath(filePath)}`;
        
        // Update CSS Variable
        document.documentElement.style.setProperty('--app-wallpaper', `url('${fileUrl}')`);
        
        // Save to store if needed
        if (save) {
            await window.electronAPI.store.set('wallpaper', filePath);
        }
    } catch (error) {
        console.error('Error setting wallpaper:', error);
    }
}

// Updated WallpaperApplet
const WallpaperApplet = {
    name: 'Wallpaper',
    icon: 'wallpaper',
    
    async createInstance(id) {
        const container = document.createElement('div');
        container.className = 'wallpaper-container';
        
        const button = document.createElement('div');
        button.className = 'wallpaper-button';
        button.innerHTML = '<span class="material-symbols-outlined">wallpaper</span>';
        
        button.addEventListener('click', async () => {
            try {
                const result = await window.electronAPI.openFileDialog({
                    filters: [
                        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
                    ]
                });
                
                if (result) {
                    await setWallpaper(result);
                }
            } catch (error) {
                console.error('Error setting wallpaper:', error);
            }
        });
        
        container.appendChild(button);
        
        // Load saved wallpaper on startup
        const savedWallpaper = await window.electronAPI.store.get('wallpaper');
        if (savedWallpaper) {
            await setWallpaper(savedWallpaper, false);
        }
        
        return {
            id,
            customContent: container
        };
    }
};

const WeatherApplet = {
    name: 'Weather',
    icon: 'cloud',
    
    async createInstance(id) {
        const container = document.createElement('div');
        container.className = 'weather-container';
        
        const weatherDisplay = document.createElement('div');
        weatherDisplay.className = 'weather-display';
        weatherDisplay.innerHTML = `
            <span class="material-symbols-outlined">cloud</span>
            <span class="weather-text">Loading...</span>
        `;
        
        container.appendChild(weatherDisplay);
        
        const loadWeather = async () => {
            try {
                const city = await window.electronAPI.store.get('weatherCity') || 'New York';
                const weatherData = await window.electronAPI.getWeather(city);
                
                const display = container.querySelector('.weather-text');
                display.textContent = `${weatherData.temp}°${weatherData.unit}`;
                
                const icon = container.querySelector('.material-symbols-outlined');
                icon.textContent = getWeatherIcon(weatherData.icon);
            } catch (error) {
                console.error('Weather error:', error);
                const display = container.querySelector('.weather-text');
                display.textContent = '--°';
            }
        };

        // Handle click to show modal
        container.addEventListener('click', async () => {
            try {
                const city = await window.electronAPI.store.get('weatherCity') || 'New York';
                const weatherData = await window.electronAPI.getWeather(city);
                showWeatherModal(weatherData);
            } catch (error) {
                console.error('Error showing weather details:', error);
            }
        });
        
        await loadWeather();
        setInterval(loadWeather, 15 * 60 * 1000);
        
        return {
            id,
            customContent: container
        };
    }
};

// Update showWeatherModal function
function showWeatherModal(data) {
    const dialog = document.createElement('sl-dialog');
    dialog.label = data.city;
    dialog.classList.add('weather-dialog');
    
    dialog.innerHTML = `
        <div class="current-weather">
            <span class="material-symbols-outlined">${getWeatherIcon(data.icon)}</span>
            <span class="temp">${data.temp}°${data.unit}</span>
            <span class="desc">${data.description}</span>
        </div>
        <div class="forecast">
            ${data.forecast.map(day => `
                <div class="forecast-day">
                    <div class="date">${day.date}</div>
                    <span class="material-symbols-outlined">${getWeatherIcon(day.icon)}</span>
                    <div class="temp">${day.temp}°${data.unit}</div>
                    <div class="desc">${day.description}</div>
                </div>
            `).join('')}
        </div>
    `;

    document.body.appendChild(dialog);
    dialog.show();

    // Remove dialog from DOM when closed
    dialog.addEventListener('sl-after-hide', () => dialog.remove());
}

// Helper function to map weather codes to material icons
function getWeatherIcon(code) {
    const iconMap = {
        '01d': 'sunny',
        '01n': 'dark_mode',
        '02d': 'partly_cloudy_day',
        '02n': 'partly_cloudy_night',
        '03d': 'cloud',
        '03n': 'cloud',
        '04d': 'cloud',
        '04n': 'cloud',
        '09d': 'rainy',
        '09n': 'rainy',
        '10d': 'rainy',
        '10n': 'rainy',
        '11d': 'thunderstorm',
        '11n': 'thunderstorm',
        '13d': 'weather_snowy',
        '13n': 'weather_snowy',
        '50d': 'foggy',
        '50n': 'foggy'
    };
    return iconMap[code] || 'cloud';
}

const SidePanelApplet = {
    name: 'Panel',
    needsIcon: true,
    
    async createInstance(id) {
        // Create container
        const container = document.createElement('div');
        container.className = 'panel-toggle-container';
        
        // Create button
        const button = document.createElement('button');
        button.className = 'panel-toggle-button';
        button.title = 'Toggle Widget Panel';
        
        // Create icon
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = 'widgets';
        
        // Add click handler
        button.addEventListener('click', () => {
            if (window.widgetManager) {
                window.widgetManager.toggleDrawer();
            }
        });
        
        // Assemble
        button.appendChild(icon);
        container.appendChild(button);
        
        return {
            id,
            customContent: container,
            destroy() {
                container.remove();
            }
        };
    }
};

// Add this to AppletManager.js, alongside other applets

const AdBlockerApplet = {
    name: 'Ad Blocker',
    needsIcon: true,
    
    async createInstance(id) {
        console.log('Creating AdBlocker applet instance');
        
        // Create container
        const container = document.createElement('div');
        container.className = 'adblocker-container';
        
        // Create icon and count elements
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'adblocker-icon-wrapper';
        
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-symbols-outlined';
        iconSpan.textContent = 'shield';
        iconSpan.style.color = '#4CAF50'; // Green color for active shield
        
        const countSpan = document.createElement('span');
        countSpan.className = 'adblocker-count';
        countSpan.textContent = '0';
        
        // Assemble elements
        iconWrapper.appendChild(iconSpan);
        container.appendChild(iconWrapper);
        container.appendChild(countSpan);
        
        // Set up listener for block count updates
        window.electronAPI.browser.adBlocker.onCountUpdate((count) => {
            console.log('Received new block count:', count);
            countSpan.textContent = count.toLocaleString();
            
            // Add a small animation on update
            countSpan.style.transform = 'scale(1.2)';
            setTimeout(() => {
                countSpan.style.transform = 'scale(1)';
            }, 150);
        });

        // Set up tooltip with more info
        const tooltip = document.createElement('sl-tooltip');
        tooltip.content = 'Ads & Trackers Blocked';
        tooltip.appendChild(container);
        
        // Add click handler to toggle blocking
        container.addEventListener('click', async () => {
            const isEnabled = await window.electronAPI.browser.adBlocker.toggle();
            iconSpan.style.color = isEnabled ? '#4CAF50' : '#D65108' ; //'#999' old grey  #D65108 Syracruse Orange-Red
            tooltip.content = `Ad Blocking ${isEnabled ? 'Enabled' : 'Disabled'}`;
        });

        return {
            id,
            customContent: tooltip,
            destroy() {
                // Cleanup if needed
            }
        };
    }
};


export { AppletManager, VolumeApplet, ClockApplet, SpacerApplet, ScreenshotApplet, WeatherApplet, SidePanelApplet, AdBlockerApplet, WallpaperApplet };
