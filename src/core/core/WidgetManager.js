
// Rest of your WidgetManager code...
// WidgetManager.js

// Base Widget class

class BaseWidget {
    constructor(config) {
        this.id = config.id || crypto.randomUUID();
        this.type = config.type;
        this.column = config.column || 0; // Left or right column
        this.title = config.title || 'Widget';
    }

    async createElement() {
        const element = document.createElement('div');
        element.className = 'widget';
        element.id = this.id;
        
        element.innerHTML = `
            <div class="widget-header">
                <span class="widget-title">${this.title}</span>
                <div class="widget-controls">
                    <sl-button size="small">↑</sl-button>
                    <sl-button size="small">↓</sl-button>
                    <sl-button size="small">×</sl-button>
                </div>
            </div>
            <div class="widget-content"></div>
        `;

        this.element = element; // Store reference
        this.setupControls(element);
        return element;
    }

    setupControls(element) {
        const [upBtn, downBtn, closeBtn] = element.querySelectorAll('sl-button');
        
        upBtn.addEventListener('click', () => this.moveUp());
        downBtn.addEventListener('click', () => this.moveDown());
        closeBtn.addEventListener('click', () => this.destroy());
    }

    moveUp() {
        window.widgetManager.moveWidget(this, 'up');
    }

    moveDown() {
        window.widgetManager.moveWidget(this, 'down');
    }

    async destroy() {
        // Remove from active widgets
        window.widgetManager.activeWidgets.delete(this.id);
        
        // Remove from storage
        const savedWidgets = await window.widgetManager.store.get('widgets') || {};
        delete savedWidgets[this.id];
        await window.widgetManager.store.set('widgets', savedWidgets);
        
        // Remove element
        this.element?.remove();
    }
}

// Calendar Widget Implementation
class CalendarWidget extends BaseWidget {
    constructor(config) {
        super({
            ...config,
            type: 'calendar',
            title: 'Calendar',
            gridSize: { w: 2, h: 2 } // Calendar default size
        });
        this.currentDate = new Date(); // today's date

    }

    async createElement() {
        const element = await super.createElement();
        element.classList.add('calendar-widget');
        
        const content = document.createElement('div');
        content.className = 'calendar-content';
        
        // Calendar UI
        content.innerHTML = `
            <div class="calendar-header">
                <sl-button size="small" class="prev-month">
                    <sl-icon name="chevron-left"></sl-icon>
                </sl-button>
                <span class="month-year"></span>
                <sl-button size="small" class="next-month">
                    <sl-icon name="chevron-right"></sl-icon>
                </sl-button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-days"></div>
                <div class="calendar-dates"></div>
            </div>
        `;
        
        element.appendChild(content);
        this.initializeCalendar(content);
        return element;
    }

    initializeCalendar(content) {
        // Set current date
        this.currentDate = new Date();
        
        // Get references to calendar elements
        this.monthYearElement = content.querySelector('.month-year');
        this.calendarDays = content.querySelector('.calendar-days');
        this.calendarDates = content.querySelector('.calendar-dates');
        
        // Add day headers
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            this.calendarDays.appendChild(dayHeader);
        });
        
        // Add date cells
        for (let i = 0; i < 42; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            this.calendarDates.appendChild(cell);
        }
        
        // Set up navigation buttons
        const prevBtn = content.querySelector('.prev-month');
        const nextBtn = content.querySelector('.next-month');
        
        prevBtn.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.updateCalendar();
            this.updateMonthYear();
        });
        
        nextBtn.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.updateCalendar();
            this.updateMonthYear();
        });
        
        // Initial update
        this.updateCalendar();
        this.updateMonthYear();
    }
    
    // Add this helper method for month/year display
    updateMonthYear() {
        const options = { month: 'long', year: 'numeric' };
        this.monthYearElement.textContent = this.currentDate.toLocaleDateString(undefined, options);
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        
        const prevBtn = document.createElement('sl-button');
        prevBtn.innerHTML = '<sl-icon name="chevron-left"></sl-icon>';
        
        const nextBtn = document.createElement('sl-button');
        nextBtn.innerHTML = '<sl-icon name="chevron-right"></sl-icon>';
        
        const title = document.createElement('div');
        title.className = 'calendar-title';
        
        header.appendChild(prevBtn);
        header.appendChild(title);
        header.appendChild(nextBtn);
        
        prevBtn.addEventListener('click', () => this.previousMonth());
        nextBtn.addEventListener('click', () => this.nextMonth());
        
        this.titleElement = title;
        this.updateTitle();
        
        return header;
    }

    createCalendarGrid() {
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        
        // Add day headers
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            grid.appendChild(dayHeader);
        });
        
        // Add day cells
        for (let i = 0; i < 42; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            grid.appendChild(cell);
        }
        
        this.gridElement = grid;
        this.updateCalendar();
        
        return grid;
    }

    updateTitle() {
        const options = { month: 'long', year: 'numeric' };
        this.titleElement.textContent = this.currentDate.toLocaleDateString(undefined, options);
    }

    updateCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const cells = this.calendarDates.querySelectorAll('.calendar-day');
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('current-month', 'other-month', 'today');
        });
        
        let currentCell = firstDay.getDay();
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const cell = cells[currentCell];
            cell.textContent = day;
            cell.classList.add('current-month');
            
            const currentDate = new Date();
            if (year === currentDate.getFullYear() && 
                month === currentDate.getMonth() && 
                day === currentDate.getDate()) {
                cell.classList.add('today');
            }
            
            currentCell++;
        }
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.updateTitle();
        this.updateCalendar();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.updateTitle();
        this.updateCalendar();
    }
}

class ClockWidget extends BaseWidget {
    constructor(config) {
        super({
            ...config,
            type: 'clock',
            title: 'Clock'
        });
        this.interval = null;
    }

    async createElement() {
        const element = await super.createElement();
        element.classList.add('clock-widget');
        
        const content = document.createElement('div');
        content.className = 'clock-content';
        content.innerHTML = `
            <div class="time">00:00:00</div>
            <div class="date"></div>
        `;
        
        element.querySelector('.widget-content').appendChild(content);
        this.startClock(content);
        return element;
    }

    startClock(content) {
        const timeDiv = content.querySelector('.time');
        const dateDiv = content.querySelector('.date');
        
        const updateClock = () => {
            const now = new Date();
            timeDiv.textContent = now.toLocaleTimeString();
            dateDiv.textContent = now.toLocaleDateString();
        };
        
        updateClock();
        this.interval = setInterval(updateClock, 1000);
    }

    destroy() {
        clearInterval(this.interval);
        super.destroy();
    }
}

class SystemMonitorWidget extends BaseWidget {
    constructor(config) {
        super({
            ...config,
            type: 'sysmonitor',
            title: 'System Monitor'
        });
        this.interval = null;
    }

    async createElement() {
        const element = await super.createElement();
        element.classList.add('sysmonitor-widget');
        
        const content = document.createElement('div');
        content.className = 'sysmonitor-content';
        content.innerHTML = `
            <div class="monitor-grid">
                <div class="monitor-item">
                    <div class="monitor-label">CPU</div>
                    <div class="monitor-value cpu">0%</div>
                    <div class="monitor-bar cpu-bar"></div>
                </div>
                <div class="monitor-item">
                    <div class="monitor-label">Memory</div>
                    <div class="monitor-value memory">0%</div>
                    <div class="monitor-bar memory-bar"></div>
                </div>
            </div>
        `;
        
        element.querySelector('.widget-content').appendChild(content);
        this.startMonitoring(content);
        return element;
    }

    async startMonitoring(content) {
        const updateStats = async () => {
            const stats = await window.electronAPI.system.getStats();
            const cpuValue = content.querySelector('.cpu');
            const memValue = content.querySelector('.memory');
            const cpuBar = content.querySelector('.cpu-bar');
            const memBar = content.querySelector('.memory-bar');
            
            cpuValue.textContent = `${stats.cpu.toFixed(1)}%`;
            memValue.textContent = `${stats.memory.toFixed(1)}%`;
            cpuBar.style.width = `${stats.cpu}%`;
            memBar.style.width = `${stats.memory}%`;
        };
        
        updateStats();
        this.interval = setInterval(updateStats, 2000);
    }

    destroy() {
        clearInterval(this.interval);
        super.destroy();
    }
}

let instance = null;

class AdvancedSystemMonitorWidget extends BaseWidget {
    constructor(config) {
        super({
            ...config,
            type: 'advanced-sysmonitor',
            title: 'System Monitor'
        });
        // this.interval = null;
        this.intervals = new Set(); // Track all intervals
        this.isDestroyed = false;
        this.expanded = false;
        this.isInitialized = false;
        this.historyData = {
            cpu: Array(60).fill(0),
            memory: Array(60).fill(0),
            timestamps: Array(60).fill(new Date())
        };
    }

    addInterval(interval) {
        this.intervals.add(interval);
    }

    async createElement() {
        const element = await super.createElement();
        this.element = element;
        element.classList.add('advanced-sysmonitor-widget');
        
        const content = document.createElement('div');
        content.className = 'sysmonitor-content';
        content.innerHTML = `
            <div class="monitor-grid">
                <!-- CPU Section -->
                <div class="monitor-section">
                    <div class="section-header">
                        <div class="section-title">
                            <span class="material-symbols-outlined">memory</span>
                            <span>CPU Usage</span>
                        </div>
                        <div class="section-value cpu">0%</div>
                    </div>
                    <div class="chart-container cpu-chart"></div>
                    <div class="monitor-details cpu-details">
                        <sl-card class="detail-card">
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Cores</span>
                                    <span class="cpu-cores">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Speed</span>
                                    <span class="cpu-speed">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Temp</span>
                                    <span class="cpu-temp">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Load</span>
                                    <span class="cpu-load">--</span>
                                </div>
                            </div>
                        </sl-card>
                    </div>
                </div>

                <!-- Memory Section -->
                <div class="monitor-section">
                    <div class="section-header">
                        <div class="section-title">
                            <span class="material-symbols-outlined">memory_alt</span>
                            <span>Memory Usage</span>
                        </div>
                        <div class="section-value memory">0%</div>
                    </div>
                    <div class="chart-container memory-chart"></div>
                    <div class="monitor-details memory-details">
                        <sl-progress-bar class="memory-bar" value="0" label="Memory Usage"></sl-progress-bar>
                        <sl-card class="detail-card">
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <span class="detail-label">Total</span>
                                    <span class="mem-total">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Used</span>
                                    <span class="mem-used">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Free</span>
                                    <span class="mem-free">--</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Cached</span>
                                    <span class="mem-cached">--</span>
                                </div>
                            </div>
                        </sl-card>
                    </div>
                </div>

                <!-- Performance Section -->
                <div class="monitor-section performance-section">
                    <div class="section-header">
                        <div class="section-title">
                            <span class="material-symbols-outlined">speed</span>
                            <span>System Performance</span>
                        </div>
                    </div>
                    <div class="performance-grid">
                        <sl-card class="perf-card">
                            <div class="perf-item">
                                <span class="material-symbols-outlined">timer</span>
                                <div class="perf-label">Uptime</div>
                                <div class="perf-value uptime">--:--:--</div>
                            </div>
                        </sl-card>
                        <sl-card class="perf-card">
                            <div class="perf-item">
                                <span class="material-symbols-outlined">deployed_code</span>
                                <div class="perf-label">Processes</div>
                                <div class="perf-value processes">--</div>
                            </div>
                        </sl-card>
                        <sl-card class="perf-card">
                            <div class="perf-item">
                                <span class="material-symbols-outlined">apps</span>
                                <div class="perf-label">Threads</div>
                                <div class="perf-value threads">--</div>
                            </div>
                        </sl-card>
                        <sl-card class="perf-card">
                            <div class="perf-item">
                                <span class="material-symbols-outlined">equalizer</span>
                                <div class="perf-label">System Load</div>
                                <div class="perf-value system-load">--</div>
                            </div>
                        </sl-card>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="monitor-controls">
                <sl-button size="small" class="refresh-stats" variant="primary">
                    <span class="material-symbols-outlined">refresh</span>
                </sl-button>
                <sl-button size="small" class="toggle-charts" variant="primary">
                    <span class="material-symbols-outlined">analytics</span>
                </sl-button>
            </div>

            <!-- Error State -->
            <div class="monitor-error hidden">
                <span class="material-symbols-outlined">error</span>
                Unable to fetch system stats
            </div>
        `;

        element.querySelector('.widget-content').appendChild(content);

        try {
            await this.setupCharts(content);
            await this.setupControls(content);
            await this.startMonitoring(content);
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize system monitor:', error);
            content.querySelector('.monitor-error')?.classList.remove('hidden');
        }

        return element;
    }

    createSVGChart(data, color, width = 300, height = 100) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.backgroundColor = 'var(--sl-color-neutral-900)';
        svg.style.borderRadius = 'var(--sl-border-radius-medium)';
        svg.style.padding = '8px';

        // Grid lines
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (let i = 0; i <= 4; i++) {
            const y = i * (height / 4);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', y.toString());
            line.setAttribute('x2', width.toString());
            line.setAttribute('y2', y.toString());
            line.setAttribute('stroke', 'var(--sl-color-neutral-700)');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '2,2');
            gridGroup.appendChild(line);
        }
        svg.appendChild(gridGroup);

        // Data path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const points = data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - (value / 100 * height);
            return `${x},${y}`;
        });
        path.setAttribute('d', `M ${points.join(' L ')}`);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);

        // Area fill
        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const areaPoints = [
            `M 0,${height}`,
            ...points.map(point => `L ${point}`),
            `L ${width},${height}`,
            'Z'
        ];
        areaPath.setAttribute('d', areaPoints.join(' '));
        areaPath.setAttribute('fill', color);
        areaPath.setAttribute('fill-opacity', '0.1');
        svg.insertBefore(areaPath, path);

        // Labels
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        [0, 50, 100].forEach(value => {
            const y = height - (value / 100 * height);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '5');
            text.setAttribute('y', y + 4);
            text.setAttribute('fill', 'var(--sl-color-neutral-400)');
            text.setAttribute('font-size', '10');
            text.textContent = `${value}%`;
            labelGroup.appendChild(text);
        });
        svg.appendChild(labelGroup);

        return svg;
    }

    setupCharts(content) {
        const cpuChart = content.querySelector('.cpu-chart');
        const memoryChart = content.querySelector('.memory-chart');

        if (cpuChart) {
            cpuChart.innerHTML = '';
            cpuChart.appendChild(this.createSVGChart(this.historyData.cpu, 'var(--sl-color-primary-600)'));
        }

        if (memoryChart) {
            memoryChart.innerHTML = '';
            memoryChart.appendChild(this.createSVGChart(this.historyData.memory, 'var(--sl-color-success-600)'));
        }
    }

    setupControls(content) {
        const refreshBtn = content.querySelector('.refresh-stats');
        const chartsBtn = content.querySelector('.toggle-charts');

        refreshBtn?.addEventListener('click', async () => {
            if (!refreshBtn.disabled) {
                refreshBtn.disabled = true;
                try {
                    await this.updateStats(content);
                    refreshBtn.querySelector('.material-symbols-outlined').style.animation = 'spin 1s linear';
                } catch (error) {
                    console.error('Failed to update stats:', error);
                }
                setTimeout(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.querySelector('.material-symbols-outlined').style.animation = '';
                }, 1000);
            }
        });

        chartsBtn?.addEventListener('click', () => {
            content.classList.toggle('charts-view');
            chartsBtn.querySelector('.material-symbols-outlined').textContent = 
                content.classList.contains('charts-view') ? 'table_chart' : 'analytics';
        });
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return `${value.toFixed(1)} ${units[unit]}`;
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async updateStats(content) {
        if (!window.electronAPI?.system?.getStats) {
            throw new Error('System stats API not available');
        }
    
        try {
            const stats = await window.electronAPI.system.getStats();
            
            // Update history data
            this.historyData.cpu.shift();
            this.historyData.cpu.push(stats.cpu);
            this.historyData.memory.shift();
            this.historyData.memory.push(stats.memory);
    
            // CPU Updates
            content.querySelector('.cpu').textContent = `${stats.cpu.toFixed(1)}%`;
            
            // OS-agnostic CPU details
            if (stats.cpuDetails) {
                content.querySelector('.cpu-cores').textContent = 
                    stats.cpuDetails.cores ? `${stats.cpuDetails.cores}` : '--';
                content.querySelector('.cpu-speed').textContent = 
                    stats.cpuDetails.speed ? `${(stats.cpuDetails.speed/1000).toFixed(1)} GHz` : '--';
                content.querySelector('.cpu-temp').textContent = 
                    stats.cpuDetails.temp ? `${stats.cpuDetails.temp}°C` : 'N/A';
                
                // Load average is shown differently on different OS
                const load = Array.isArray(stats.loadAverage) ? 
                    stats.loadAverage[0] : // Linux style
                    stats.loadAverage;     // Windows style
                content.querySelector('.cpu-load').textContent = 
                    load ? load.toFixed(2) : '--';
            }
    
            // Memory Updates - works same on all OS
            content.querySelector('.memory').textContent = `${stats.memory.toFixed(1)}%`;
            content.querySelector('.memory-bar').value = stats.memory;
            
            if (stats.memoryDetails) {
                content.querySelector('.mem-total').textContent = this.formatBytes(stats.memoryDetails.total || 0);
                content.querySelector('.mem-used').textContent = this.formatBytes(stats.memoryDetails.used || 0);
                content.querySelector('.mem-free').textContent = this.formatBytes(stats.memoryDetails.available || 0);
                content.querySelector('.mem-cached').textContent = this.formatBytes(stats.memoryDetails.cached || 0);
            }
    
            // Performance metrics - OS agnostic
            content.querySelector('.uptime').textContent = this.formatUptime(stats.uptime || 0);
            content.querySelector('.processes').textContent = stats.processCount || '--';
            content.querySelector('.threads').textContent = stats.threadCount || '--';
            content.querySelector('.system-load').textContent = 
                (stats.loadAverage ? stats.loadAverage[0] : stats.load)?.toFixed(2) || '--';
    
            // Update charts
            this.setupCharts(content);
            content.querySelector('.monitor-error')?.classList.add('hidden');
        } catch (error) {
            console.error('Failed to update system stats:', error);
            content.querySelector('.monitor-error')?.classList.remove('hidden');
        }
    }

    pause() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('System monitor paused');
        }
    }
    
    resume() {
        if (!this.interval && this.isInitialized) {
            this.startMonitoring(this.element.querySelector('.sysmonitor-content'));
            console.log('System monitor resumed');
        }
    }

    async startMonitoring(content) {
        if (this.isDestroyed) return;

        const interval = setInterval(async () => {
            if (!this.isDestroyed && this.isInitialized) {
                await this.updateStats(content);
            }
        }, 2000); // Increased interval for better performance

        this.addInterval(interval);
    }

    destroy() {
        this.isDestroyed = true;
        
        // Clear all intervals
        this.intervals.forEach(interval => {
            clearInterval(interval);
        });
        this.intervals.clear();

        // Cleanup charts
        if (this.cpuChart) this.cpuChart.destroy();
        if (this.memoryChart) this.memoryChart.destroy();

        // Call parent destroy
        super.destroy();
    }

    // destroy() {
    //     clearInterval(this.interval);
    //     super.destroy();
    // }
}

// Widget Manager

class WidgetManager {
    constructor() {
        if (instance) return instance;
        
        this.columns = {
            left: document.createElement('div'),
            right: document.createElement('div')
        };
        
        this.columns.left.className = 'widget-column';
        this.columns.right.className = 'widget-column';
        
        this.widgets = new Map();
        this.activeWidgets = new Map();
        this.store = window.electronAPI.store;
        this.drawer = null;
        
        this.initializeDrawer();
        this.registerBuiltInWidgets();
        this.loadSavedWidgets();
        
        instance = this;
    }

    // Add missing methods
    toggleDrawer() {
        console.log('Toggle drawer called');
        if (this.drawer?.open) {
            this.hideDrawer();
        } else {
            this.showDrawer();
        }
    }

    showDrawer() {
        console.log('Show drawer called');
        this.drawer?.show();
        // Resume all widget updates
        this.resumeAllWidgets();
    }
    
    hideDrawer() {
        console.log('Hide drawer called');
        this.drawer?.hide();
        // Pause all widget updates to save resources
        this.pauseAllWidgets();
    }
    
    pauseAllWidgets() {
        this.activeWidgets.forEach(widget => {
            if (widget.pause && typeof widget.pause === 'function') {
                widget.pause();
            }
        });
    }
    
    resumeAllWidgets() {
        this.activeWidgets.forEach(widget => {
            if (widget.resume && typeof widget.resume === 'function') {
                widget.resume();
            }
        });
    }

    // Add missing methods
    registerBuiltInWidgets() {
        console.log('Registering built-in widgets');
        this.registerWidget('calendar', CalendarWidget);
        this.registerWidget('clock', ClockWidget);
        this.registerWidget('sysmonitor', SystemMonitorWidget);
        this.registerWidget('advanced-sysmonitor', AdvancedSystemMonitorWidget);
    }

    registerWidget(type, widgetClass) {
        this.widgets.set(type, widgetClass);
    }

    async resetStorage() {
        console.log('Resetting widget storage...');
        
        // Clear storage
        await this.store.set('widgets', {});
        await this.store.set('widget-positions', {});
        
        // Clear active widgets
        this.activeWidgets.clear();
        
        // Clear columns
        this.columns.left.innerHTML = '';
        this.columns.right.innerHTML = '';
        
        return true;
    }

    async loadSavedWidgets() {
        console.log('Loading saved widgets...');
        const savedWidgets = await this.store.get('widgets') || {};
    
        if (Object.keys(savedWidgets).length === 0) {
            // Create default widgets
            const calendarWidget = await this.createWidget('calendar', {
                column: 0  // Left column
            });
            const clockWidget = await this.createWidget('clock', {
                column: 1  // Right column
            });
    
            // Save both widgets
            if (calendarWidget) {
                await this.saveWidgetConfig(calendarWidget.id, calendarWidget);
            }
            if (clockWidget) {
                await this.saveWidgetConfig(clockWidget.id, clockWidget);
            }
        } else {
            for (const [id, config] of Object.entries(savedWidgets)) {
                if (!this.activeWidgets.has(id)) {
                    await this.createWidget(config.type, config);
                }
            }
        }
    }

    async saveWidgetConfig(id, config) {
        const savedWidgets = await this.store.get('widgets') || {};
        savedWidgets[id] = config;
        await this.store.set('widgets', savedWidgets);
    }


    initializeDrawer() {
        if (!document.querySelector('#side-panel-drawer')) {
            const drawer = document.createElement('sl-drawer');
            drawer.id = 'side-panel-drawer';
            drawer.label = 'Widgets';
            drawer.placement = 'end';
            drawer.style.setProperty('--size', '800px');
            
            // Create widget selector in header
            const select = document.createElement('sl-select');
            select.placeholder = 'Add Widget';
            select.slot = 'header-actions';
            select.style.width = '200px';
            
            const widgetTypes = [
                ['calendar', 'Calendar'],
                ['clock', 'Clock'],
                ['sysmonitor', 'System Monitor'],
                ['advanced-sysmonitor', 'Advanced Monitor'],
                ['file', 'Load from File...']
            ];
            
            widgetTypes.forEach(([value, label]) => {
                const option = document.createElement('sl-option');
                option.value = value;
                option.textContent = label;
                select.appendChild(option);
            });
            
            select.addEventListener('sl-change', async () => {
                const type = select.value;
                if (type === 'file') {
                    const filePath = await window.electronAPI.files.openFileDialog({
                        filters: [
                            { name: 'Widget Files', extensions: ['js'] }
                        ],
                        title: 'Select Widget File'
                    });
                    
                    if (filePath) {
                        await this.loadWidgetFromFile(filePath);
                    }
                } else if (type) {
                    const widget = await this.createWidget(type);
                    if (widget) {
                        await this.saveWidgetConfig(widget.id, {
                            id: widget.id,
                            type: widget.type,
                            column: widget.column
                        });
                    }
                }
                select.value = '';
            });
            
            drawer.appendChild(select);
            
            // Content area
            const content = document.createElement('div');
            content.className = 'side-panel-content';
            content.appendChild(this.columns.left);
            content.appendChild(this.columns.right);
            drawer.appendChild(content);
            
            document.body.appendChild(drawer);
            this.drawer = drawer;
        }
    }
    
    async loadWidgetFromFile(path) {
        try {
            const widgetModule = await import(path);
            const WidgetClass = widgetModule.default;
            this.registerWidget(path, WidgetClass);
            return this.createWidget(path);
        } catch (error) {
            console.error('Failed to load widget:', error);
            return null;
        }
    }

    selectNextColumn() {
        const leftCount = this.columns.left.children.length;
        const rightCount = this.columns.right.children.length;
        return leftCount <= rightCount ? 0 : 1;
    }

    async createWidget(type, config = {}) {
        const id = config.id || `widget-${Date.now()}`;
        if (this.activeWidgets.has(id)) return null;

        const WidgetClass = this.widgets.get(type);
        if (!WidgetClass) return null;

        // Assign column if not specified
        if (config.column === undefined) {
            config.column = this.selectNextColumn();
        }

        const widget = new WidgetClass({
            id,
            type,
            ...config
        });

        const element = await widget.createElement();
        const column = widget.column === 0 ? this.columns.left : this.columns.right;
        column.appendChild(element);
        this.activeWidgets.set(id, widget);

        return widget;
    }

    moveWidget(widget, direction) {
        const column = widget.column === 0 ? this.columns.left : this.columns.right;
        const widgets = [...column.children];
        const index = widgets.indexOf(widget.element);
        
        if (direction === 'up' && index > 0) {
            column.insertBefore(widget.element, widgets[index - 1]);
        } else if (direction === 'down' && index < widgets.length - 1) {
            const nextElement = widgets[index + 2] || null;
            column.insertBefore(widget.element, nextElement);
        }

        this.saveWidgetPositions();
    }

    async saveWidgetPositions() {
        const positions = {
            left: [...this.columns.left.children].map(el => el.id),
            right: [...this.columns.right.children].map(el => el.id)
        };
        await this.store.set('widget-positions', positions);
    }
}

export { WidgetManager as default, BaseWidget, CalendarWidget, ClockWidget, SystemMonitorWidget, AdvancedSystemMonitorWidget  };