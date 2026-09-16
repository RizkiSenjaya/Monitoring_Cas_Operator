/**
 * RPM Web Monitoring - Main Application Logic
 * Integrates with Laravel API and renders rich UI matching Images 1, 2, and 3.
 */

// Global State
const state = {
    activeTab: 'dashboard',
    activeDb: 'rpm_1.db',
    selectedDate: '2025-11-15',
    selectedIdk: '251115095949',
    refreshInterval: null,
    realtimeInterval: null,
    realtime1sInterval: null,
    charts: {},
    allAlarms: [],
    activeAlarmFilter: 'all',
    historisFilterMode: '1hour', // '1hour' | 'hour' | 'day' | 'month'
    filterDate: '2025-11-14',
    filterHour: 8,
    filterMonth: '2025-11',
    okupasiBuffer: [], // sliding window buffer: Array of { label, value, hasAlarm }
    alarmBuffer: [], // sliding window buffer: Array of { label, count }
    maxOkupasiPoints: 35,
    isAlarmActive: false
};

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-rose-600 text-white',
        info: 'bg-sky-600 text-white',
        warning: 'bg-amber-600 text-white'
    };
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Format numbers with indonesian dot separators e.g. 2.031.348
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initDashboard();
    initHistorisCalendar();
    initDatabaseSwitcher();
    initAlarmFilters();
    initHistorisFilterBar();
    startRealtimePolling();
});

// Live Running Clock
function initClock() {
    const clockEl = document.getElementById('live-clock');
    function updateClock() {
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        if (clockEl) clockEl.textContent = `• LIVE ${timeStr}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// SPA Navigation (Tab Switching without page reload)
function initNavigation() {
    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab-target');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    state.activeTab = tabName;

    // Update buttons
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
        const isTarget = btn.getAttribute('data-tab-target') === tabName;
        if (isTarget) {
            btn.classList.add('bg-cyan-500/20', 'text-cyan-400', 'border-l-4', 'border-cyan-400');
            btn.classList.remove('text-slate-400', 'hover:bg-slate-800/50');
        } else {
            btn.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'border-l-4', 'border-cyan-400');
            btn.classList.add('text-slate-400', 'hover:bg-slate-800/50');
        }
    });

    // Update views
    document.querySelectorAll('[data-tab-view]').forEach(view => {
        if (view.getAttribute('data-tab-view') === tabName) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    });

    // Trigger tab specific loads
    if (tabName === 'dashboard') {
        loadDashboardStats();
    } else if (tabName === 'historis') {
        loadHistorisVehicles(state.selectedDate);
    } else if (tabName === 'alarm') {
        loadAlarmPage();
    } else if (tabName === 'sistem') {
        loadSystemStatus();
    }
}

// ==========================================
// DASHBOARD LOGIC (Images 2 & 3)
// ==========================================
function initDashboard() {
    loadDashboardStats();
    loadDashboardCharts();
    loadTelemetryCharts();
    loadRecentAlarms();

    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showToast('Memperbarui data dashboard...', 'info');
            loadDashboardStats();
            loadDashboardCharts();
            loadTelemetryCharts();
            loadRecentAlarms(true);
        });
    }
}

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const json = await res.json();
        if (json.status === 'success') {
            const d = json.data;
            state.activeDb = d.active_db;
            state.isAlarmActive = !!d.is_alarm_active;

            // Update 4 Cards
            document.getElementById('stat-total-okupasi').textContent = formatNumber(d.total_okupasi);
            document.getElementById('stat-total-alarm').textContent = formatNumber(d.total_alarm);
            document.getElementById('stat-data-log').textContent = formatNumber(d.data_log);
            document.getElementById('stat-data-latar').textContent = formatNumber(d.data_latar);

            // Update Status Terakhir Card
            const lr = d.latest_reading || {};
            document.getElementById('status-terakhir-waktu').textContent = lr.TANGGAL || '2025-11-14 9:56:26';
            document.getElementById('det-a-val').textContent = `${formatNumber(lr.A1 || 1160)} / ${formatNumber(lr.A2 || 940)}`;
            document.getElementById('det-b-val').textContent = `${formatNumber(lr.B1 || 1050)} / ${formatNumber(lr.B2 || 850)}`;
            document.getElementById('suhu-val').textContent = `${lr.TEMP || 37} °C`;
            document.getElementById('humidity-val').textContent = `${lr.HUMIDITY || 47} %`;

            // Ringkasan Sistem
            document.getElementById('ringkasan-det-a').textContent = d.detector_a_status || 'NORMAL';
            document.getElementById('ringkasan-det-b').textContent = d.detector_b_status || 'NORMAL';
            document.getElementById('ringkasan-okupasi').textContent = d.okupasi_status || 'YA';
            document.getElementById('ringkasan-alarm').textContent = d.is_alarm_active ? 'AKTIF' : 'NORMAL';

            // Active DB label in footer
            const dbBadge = document.getElementById('active-db-label');
            if (dbBadge) dbBadge.textContent = d.active_db;

            // Update Okupasi Chart state
            if (state.charts.okupasi) {
                renderOrUpdateOkupasiChart();
            }
        }
    } catch (e) {
        console.error('Error fetching dashboard stats:', e);
    }
}

// ==========================================
// TIME RANGE FILTER & REAL-TIME ENGINE (1 JAM TERAKHIR TIAP DETIK)
// ==========================================

function initHistorisFilterBar() {
    // 1. Populate hour select (00:00 - 23:00)
    const hourSelect = document.getElementById('filter-hour-select');
    if (hourSelect && hourSelect.children.length === 0) {
        for (let h = 0; h < 24; h++) {
            const hStr = h.toString().padStart(2, '0');
            const hNext = ((h + 1) % 24).toString().padStart(2, '0');
            const opt = document.createElement('option');
            opt.value = h;
            opt.className = 'bg-slate-900 text-slate-200';
            opt.textContent = `${hStr}:00 - ${hNext}:00`;
            if (h === 8) opt.selected = true;
            hourSelect.appendChild(opt);
        }
    }

    // 2. Mode buttons click handlers
    const modeButtons = document.querySelectorAll('#historis-mode-buttons button');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            setHistorisMode(mode);
        });
    });

    // 3. Apply button click handler
    const applyBtn = document.getElementById('btn-apply-historis-filter');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            loadHistoricalChartsFiltered(state.historisFilterMode);
        });
    }
}

function setHistorisMode(mode) {
    state.historisFilterMode = mode;

    // Update segmented buttons visual
    document.querySelectorAll('#historis-mode-buttons button').forEach(b => {
        const isSelected = b.getAttribute('data-mode') === mode;
        if (isSelected) {
            b.className = 'filter-mode-btn px-3 py-1 rounded-md text-xs font-bold transition-all bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm';
            if (mode === '1hour') {
                b.innerHTML = '<span class="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-1 pulse-live"></span>LIVE 1 Jam';
            }
        } else {
            b.className = 'filter-mode-btn px-3 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200';
            if (b.getAttribute('data-mode') === '1hour') {
                b.textContent = 'LIVE 1 Jam';
            }
        }
    });

    const liveIndicator = document.getElementById('filter-live-indicator');
    const dateGroup = document.getElementById('filter-date-group');
    const hourGroup = document.getElementById('filter-hour-group');
    const monthGroup = document.getElementById('filter-month-group');
    const applyBtn = document.getElementById('btn-apply-historis-filter');

    if (mode === '1hour') {
        if (liveIndicator) liveIndicator.classList.remove('hidden');
        if (dateGroup) dateGroup.classList.add('hidden');
        if (hourGroup) hourGroup.classList.add('hidden');
        if (monthGroup) monthGroup.classList.add('hidden');
        if (applyBtn) applyBtn.classList.add('hidden');

        showToast('Mode LIVE 1 Jam Terakhir tiap detik aktif', 'info');
        loadHistoricalChartsFiltered('1hour');
    } else if (mode === 'hour') {
        if (liveIndicator) liveIndicator.classList.add('hidden');
        if (dateGroup) dateGroup.classList.remove('hidden');
        if (hourGroup) hourGroup.classList.remove('hidden');
        if (monthGroup) monthGroup.classList.add('hidden');
        if (applyBtn) applyBtn.classList.remove('hidden');

        loadHistoricalChartsFiltered('hour');
    } else if (mode === 'day') {
        if (liveIndicator) liveIndicator.classList.add('hidden');
        if (dateGroup) dateGroup.classList.remove('hidden');
        if (hourGroup) hourGroup.classList.add('hidden');
        if (monthGroup) monthGroup.classList.add('hidden');
        if (applyBtn) applyBtn.classList.remove('hidden');

        loadHistoricalChartsFiltered('day');
    } else if (mode === 'month') {
        if (liveIndicator) liveIndicator.classList.add('hidden');
        if (dateGroup) dateGroup.classList.add('hidden');
        if (hourGroup) hourGroup.classList.add('hidden');
        if (monthGroup) monthGroup.classList.remove('hidden');
        if (applyBtn) applyBtn.classList.remove('hidden');

        loadHistoricalChartsFiltered('month');
    }
}

async function loadDashboardCharts() {
    loadHistoricalChartsFiltered(state.historisFilterMode || '1hour');
}

async function loadHistoricalChartsFiltered(mode) {
    const dateInput = document.getElementById('filter-date-input');
    const hourSelect = document.getElementById('filter-hour-select');
    const monthSelect = document.getElementById('filter-month-select');

    const dateVal = dateInput ? dateInput.value : '2025-11-14';
    const hourVal = hourSelect ? hourSelect.value : '8';
    const monthVal = monthSelect ? monthSelect.value : '2025-11';

    let url = `/api/dashboard/charts-filtered?mode=${mode}`;
    if (mode === 'hour') url += `&date=${dateVal}&hour=${hourVal}`;
    if (mode === 'day') url += `&date=${dateVal}`;
    if (mode === 'month') url += `&month=${monthVal}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === 'success') {
            const d = json.data;

            // Update card titles and subtitles
            const okTitle = document.getElementById('okupasi-chart-title');
            if (okTitle) okTitle.textContent = d.title_okupasi || 'Historis Okupasi';
            const okSubtitle = document.getElementById('okupasi-chart-subtitle');
            if (okSubtitle) okSubtitle.textContent = d.subtitle_okupasi || 'Real-time sliding window (prioritas data baru)';

            const alTitle = document.getElementById('alarm-chart-title');
            if (alTitle) alTitle.textContent = d.title_alarm || 'Historis Alarm';
            const alSubtitle = document.getElementById('alarm-chart-subtitle');
            if (alSubtitle) alSubtitle.textContent = d.subtitle_alarm || 'Event per hari';

            const rawLabels = d.labels || [];
            const rawOkupasi = d.okupasi?.series || [];
            const rawAlarms = d.okupasi?.alarms || [];
            const rawAlarmCounts = d.alarm?.series || [];

            if (mode === '1hour') {
                state.okupasiBuffer = [];
                state.alarmBuffer = [];
                for (let i = 0; i < rawLabels.length; i++) {
                    state.okupasiBuffer.push({
                        label: rawLabels[i],
                        value: rawOkupasi[i],
                        hasAlarm: !!rawAlarms[i]
                    });
                    state.alarmBuffer.push({
                        label: rawLabels[i],
                        count: rawAlarmCounts[i] || 0
                    });
                }

                renderOrUpdateOkupasiChart();
                renderOrUpdateAlarmChart();

                // Start 1-second real-time streaming
                start1SecondStreaming();
            } else {
                // Stop 1-second streaming in filtered historical mode
                stop1SecondStreaming();

                state.okupasiBuffer = [];
                state.alarmBuffer = [];
                for (let i = 0; i < rawLabels.length; i++) {
                    state.okupasiBuffer.push({
                        label: rawLabels[i],
                        value: rawOkupasi[i],
                        hasAlarm: !!rawAlarms[i]
                    });
                    state.alarmBuffer.push({
                        label: rawLabels[i],
                        count: rawAlarmCounts[i] || 0
                    });
                }

                renderOrUpdateOkupasiChart(rawLabels, rawOkupasi, rawAlarms);
                renderOrUpdateAlarmChart(rawLabels, rawAlarmCounts);
            }
        }
    } catch (e) {
        console.error('Error fetching filtered charts:', e);
    }
}

// Push a single realtime sample to the sliding window buffer (FIFO)
function pushOkupasiSample(label, value, hasAlarm) {
    if (!state.okupasiBuffer) state.okupasiBuffer = [];
    state.okupasiBuffer.push({
        label: label,
        value: value,
        hasAlarm: !!hasAlarm
    });

    while (state.okupasiBuffer.length > state.maxOkupasiPoints) {
        state.okupasiBuffer.shift();
    }

    renderOrUpdateOkupasiChart();
}

function pushAlarmSample(label, count) {
    if (!state.alarmBuffer) state.alarmBuffer = [];
    state.alarmBuffer.push({
        label: label,
        count: count || 0
    });

    while (state.alarmBuffer.length > state.maxOkupasiPoints) {
        state.alarmBuffer.shift();
    }

    renderOrUpdateAlarmChart();
}

// Render or smooth update Historis Okupasi
// Retains the original blue/cyan graphics, with red gradient ONLY in the area where alarms appear
function renderOrUpdateOkupasiChart(customLabels, customSeries, customAlarms) {
    const canvas = document.getElementById('chart-okupasi');
    if (!canvas) return;

    let labels = [];
    let seriesOkupasi = [];
    let hasAlarmFlags = [];

    if (customLabels && customSeries) {
        labels = customLabels;
        seriesOkupasi = customSeries;
        hasAlarmFlags = customAlarms || customSeries.map(() => false);
    } else if (state.okupasiBuffer && state.okupasiBuffer.length > 0) {
        labels = state.okupasiBuffer.map(p => p.label);
        seriesOkupasi = state.okupasiBuffer.map(p => p.value);
        hasAlarmFlags = state.okupasiBuffer.map(p => p.hasAlarm);
    } else {
        return;
    }

    const ctx = canvas.getContext('2d');
    const height = canvas.clientHeight || 240;

    // 1. Base Cyan/Blue Vertical Gradient (Original graphic style)
    const cyanGradient = ctx.createLinearGradient(0, 0, 0, height);
    cyanGradient.addColorStop(0, 'rgba(0, 229, 255, 0.28)');
    cyanGradient.addColorStop(0.65, 'rgba(0, 229, 255, 0.08)');
    cyanGradient.addColorStop(1, 'rgba(0, 229, 255, 0.00)');

    // 2. Alarm Red Vertical Gradient (Applied ONLY to alarm areas)
    const redGradient = ctx.createLinearGradient(0, 0, 0, height);
    redGradient.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
    redGradient.addColorStop(0.65, 'rgba(239, 68, 68, 0.18)');
    redGradient.addColorStop(1, 'rgba(239, 68, 68, 0.00)');

    // Alarm overlay dataset: only has values on points where an alarm occurred and their immediate transitions
    const seriesAlarm = seriesOkupasi.map((pVal, idx) => {
        const isSelfAlarm = hasAlarmFlags[idx];
        const isPrevAlarm = hasAlarmFlags[idx - 1];
        const isNextAlarm = hasAlarmFlags[idx + 1];
        if (isSelfAlarm || isPrevAlarm || isNextAlarm) {
            return pVal;
        }
        return null;
    });

    const hasAnyAlarm = hasAlarmFlags.some(v => !!v) || state.isAlarmActive;

    // Update Header Badge
    const badge = document.getElementById('okupasi-alarm-badge');
    if (badge) {
        if (hasAnyAlarm) {
            badge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all';
            badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block mr-1.5 animate-pulse"></span>EVENT ALARM TERDETEKSI';
        } else {
            badge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all';
            badge.textContent = (state.historisFilterMode === '1hour') ? 'NORMAL REAL-TIME' : 'NORMAL';
        }
    }

    const datasets = [
        // Dataset 1: Base Okupasi (Blue/Cyan - exactly matching original graphic)
        {
            label: 'Okupasi',
            data: seriesOkupasi,
            borderColor: '#00E5FF',
            backgroundColor: cyanGradient,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: (c) => hasAlarmFlags[c.dataIndex] ? 0 : 2,
            pointHoverRadius: 5,
            pointBackgroundColor: '#00E5FF',
            segment: {
                borderColor: ctx => {
                    const p0 = hasAlarmFlags[ctx.p0DataIndex];
                    const p1 = hasAlarmFlags[ctx.p1DataIndex];
                    if (p0 || p1) {
                        return '#EF4444'; // Red stroke only in alarm zone!
                    }
                    return '#00E5FF';
                }
            },
            order: 2
        },
        // Dataset 2: Area Event Alarm (Red gradient highlight strictly in alarm zone)
        {
            label: 'Area Event Alarm',
            data: seriesAlarm,
            borderColor: '#EF4444',
            backgroundColor: redGradient,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            spanGaps: false,
            pointRadius: (c) => hasAlarmFlags[c.dataIndex] ? 5.5 : 0,
            pointHoverRadius: (c) => hasAlarmFlags[c.dataIndex] ? 8 : 0,
            pointBackgroundColor: '#EF4444',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            order: 1
        }
    ];

    if (!state.charts.okupasi) {
        state.charts.okupasi = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#94A3B8',
                            font: { size: 11 },
                            boxWidth: 14,
                            filter: function(item) {
                                if (item.text === 'Area Event Alarm') {
                                    return hasAlarmFlags.some(v => !!v);
                                }
                                return true;
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#F8FAFC',
                        bodyColor: '#38BDF8',
                        borderColor: '#334155',
                        borderWidth: 1,
                        callbacks: {
                            label: function(ctx) {
                                const idx = ctx.dataIndex;
                                const isAlm = hasAlarmFlags[idx];
                                if (ctx.datasetIndex === 1) {
                                    return isAlm ? `⚠️ EVENT ALARM: ${formatNumber(ctx.parsed.y)}` : null;
                                }
                                return `Okupasi: ${formatNumber(ctx.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 0 }
                    },
                    y: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: {
                            color: '#64748B',
                            font: { size: 10 },
                            callback: function(val) { return formatNumber(val); }
                        }
                    }
                }
            }
        });
    } else {
        const chart = state.charts.okupasi;
        chart.data.labels = labels;
        chart.data.datasets[0].data = seriesOkupasi;
        chart.data.datasets[0].backgroundColor = cyanGradient;
        chart.data.datasets[1].data = seriesAlarm;
        chart.data.datasets[1].backgroundColor = redGradient;
        chart.update('none');
    }
}

// Render or smooth update Historis Alarm
function renderOrUpdateAlarmChart(customLabels, customSeries) {
    const canvas = document.getElementById('chart-alarm');
    if (!canvas) return;

    let labels = [];
    let series = [];

    if (customLabels && customSeries) {
        labels = customLabels;
        series = customSeries;
    } else if (state.alarmBuffer && state.alarmBuffer.length > 0) {
        labels = state.alarmBuffer.map(p => p.label);
        series = state.alarmBuffer.map(p => p.count);
    } else {
        return;
    }

    const hasAnyAlarm = series.some(v => v > 0);

    const badge = document.getElementById('alarm-rate-badge');
    if (badge) {
        if (state.historisFilterMode === '1hour') {
            badge.className = hasAnyAlarm 
                ? 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                : 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700';
            badge.textContent = hasAnyAlarm ? 'ALARM AKTIF' : 'LIVE 1 JAM';
        } else if (state.historisFilterMode === 'hour') {
            badge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30';
            badge.textContent = 'PER JAM (60 MENIT)';
        } else if (state.historisFilterMode === 'day') {
            badge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30';
            badge.textContent = 'PER HARI (24 JAM)';
        } else if (state.historisFilterMode === 'month') {
            badge.className = 'px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30';
            badge.textContent = 'PER BULAN';
        }
    }

    if (!state.charts.alarm) {
        state.charts.alarm = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Alarm',
                    data: series,
                    borderColor: '#38BDF8',
                    backgroundColor: 'rgba(56, 189, 248, 0.18)',
                    borderWidth: 2,
                    tension: 0.35,
                    fill: true,
                    pointRadius: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return (val && val > 0) ? 4.5 : 1.5;
                    },
                    pointHoverRadius: 6,
                    pointBackgroundColor: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return (val && val > 0) ? '#EF4444' : '#38BDF8';
                    },
                    pointBorderColor: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return (val && val > 0) ? '#FFFFFF' : '#38BDF8';
                    },
                    pointBorderWidth: (ctx) => {
                        const val = ctx.dataset.data[ctx.dataIndex];
                        return (val && val > 0) ? 1.5 : 0;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        titleColor: '#F8FAFC',
                        bodyColor: '#38BDF8',
                        borderColor: '#334155',
                        borderWidth: 1,
                        callbacks: {
                            label: function(ctx) {
                                return `Alarm: ${formatNumber(ctx.parsed.y)} Event`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 0 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(51, 65, 85, 0.3)' },
                        ticks: {
                            color: '#64748B',
                            font: { size: 10 },
                            precision: 0,
                            callback: function(val) { return formatNumber(val); }
                        }
                    }
                }
            }
        });
    } else {
        state.charts.alarm.data.labels = labels;
        state.charts.alarm.data.datasets[0].data = series;
        state.charts.alarm.update('none');
    }
}

// 1-Second Real-Time Streaming Interval for LIVE 1 Jam Mode
function start1SecondStreaming() {
    stop1SecondStreaming();

    state.realtime1sInterval = setInterval(async () => {
        if (state.historisFilterMode !== '1hour') {
            stop1SecondStreaming();
            return;
        }

        try {
            const res = await fetch('/api/dashboard/tick');
            const json = await res.json();
            if (json.status === 'success') {
                const tick = json.data;
                state.isAlarmActive = !!tick.is_alarm;

                // 1. Update live cards
                const timeEl = document.getElementById('status-terakhir-waktu');
                if (timeEl) timeEl.textContent = tick.db_time || tick.time;
                const detA = document.getElementById('det-a-val');
                if (detA) detA.textContent = `${formatNumber(tick.a1)} / ${formatNumber(tick.a2)}`;
                const detB = document.getElementById('det-b-val');
                if (detB) detB.textContent = `${formatNumber(tick.b1)} / ${formatNumber(tick.b2)}`;
                const suhu = document.getElementById('suhu-val');
                if (suhu) suhu.textContent = `${tick.temp} °C`;
                const hum = document.getElementById('humidity-val');
                if (hum) hum.textContent = `${tick.humidity} %`;
                const ringkasanAlarm = document.getElementById('ringkasan-alarm');
                if (ringkasanAlarm) {
                    ringkasanAlarm.textContent = tick.is_alarm ? 'AKTIF' : 'NORMAL';
                    ringkasanAlarm.className = tick.is_alarm ? 'font-bold text-rose-500' : 'font-bold text-emerald-400';
                }

                // 2. Sliding tick on Okupasi Chart
                const now = new Date();
                const secLabel = now.toTimeString().split(' ')[0]; // HH:MM:SS
                pushOkupasiSample(secLabel, tick.cps, tick.is_alarm);

                // 3. Sliding tick on Alarm Chart
                pushAlarmSample(secLabel, tick.alarm_count);

                // 4. CPS Chart smooth update
                if (state.charts.cps && state.charts.cps.data) {
                    const cpsLabels = state.charts.cps.data.labels;
                    const ds115 = state.charts.cps.data.datasets[0].data;
                    const ds116 = state.charts.cps.data.datasets[1].data;
                    if (cpsLabels.length > 20) {
                        cpsLabels.shift();
                        ds115.shift();
                        ds116.shift();
                    }
                    cpsLabels.push(secLabel.substring(0, 5));
                    ds115.push(tick.a1);
                    ds116.push(tick.b1);
                    state.charts.cps.update('none');
                }
            }
        } catch (err) {
            // Silently ignore transient network glitch
        }
    }, 1000); // Tiap 1 detik
}

function stop1SecondStreaming() {
    if (state.realtime1sInterval) {
        clearInterval(state.realtime1sInterval);
        state.realtime1sInterval = null;
    }
}

// Background Realtime Engine (initiates live stream)
function startRealtimePolling() {
    if (state.historisFilterMode === '1hour') {
        start1SecondStreaming();
    }
}async function loadTelemetryCharts() {
    try {
        const res = await fetch('/api/dashboard/charts');
        const json = await res.json();
        if (json.status === 'success') {
            renderTelemetryCharts(json.data);
        }
    } catch (e) {
        console.error('Error fetching telemetry charts:', e);
    }
}

function renderTelemetryCharts(data) {
    if (!data || !data.realtime) return;

    // 3. Chart Realtime Laju Cacah
    const cpsCtx = document.getElementById('chart-cps-realtime');
    if (cpsCtx && data.realtime) {
        if (state.charts.cps) state.charts.cps.destroy();
        state.charts.cps = new Chart(cpsCtx, {
            type: 'line',
            data: {
                labels: data.realtime.labels,
                datasets: [
                    {
                        label: 'Pilar 115 (cps)',
                        data: data.realtime.cps115,
                        borderColor: '#00E5FF',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        label: 'Pilar 116 (cps)',
                        data: data.realtime.cps116,
                        borderColor: '#3B82F6',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    }
                ]
            },
            options: getDarkChartOptions('Laju Cacah Realtime 1 Jam Terakhir', 'cps')
        });
    }

    // 4. Chart Suhu & Kelembaban
    const envCtx = document.getElementById('chart-env-realtime');
    if (envCtx && data.realtime) {
        if (state.charts.env) state.charts.env.destroy();
        state.charts.env = new Chart(envCtx, {
            type: 'line',
            data: {
                labels: data.realtime.labels,
                datasets: [
                    {
                        label: 'Suhu Pilar 115 (°C)',
                        data: data.realtime.temp115,
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        label: 'Suhu Pilar 116 (°C)',
                        data: data.realtime.temp116,
                        borderColor: '#EF4444',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        label: 'Kelembaban Pilar 115 (%)',
                        data: data.realtime.rh115,
                        borderColor: '#10B981',
                        borderDash: [4, 4],
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    }
                ]
            },
            options: getDarkChartOptions('Suhu (°C) & Kelembaban (%) Realtime', 'Nilai')
        });
    }
}

function getDarkChartOptions(title, yLabel) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: { color: '#94A3B8', font: { size: 11 } }
            },
            tooltip: {
                backgroundColor: '#0F172A',
                titleColor: '#F8FAFC',
                bodyColor: '#38BDF8',
                borderColor: '#334155',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(51, 65, 85, 0.3)' },
                ticks: { color: '#64748B', font: { size: 10 } }
            },
            y: {
                grid: { color: 'rgba(51, 65, 85, 0.3)' },
                ticks: { color: '#64748B', font: { size: 10 } }
            }
        }
    };
}

// Initialize Alarm tab quick filters
function initAlarmFilters() {
    document.querySelectorAll('[data-alarm-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-alarm-filter');
            state.activeAlarmFilter = filter;
            document.querySelectorAll('[data-alarm-filter]').forEach(b => {
                b.classList.remove('text-cyan-400', 'bg-slate-800', 'font-semibold');
                b.classList.add('text-slate-400');
            });
            btn.classList.add('text-cyan-400', 'bg-slate-800', 'font-semibold');
            btn.classList.remove('text-slate-400');
            renderAlarmTable();
        });
    });
}

// Render Alarm Table in Alarm Tab
function renderAlarmTable() {
    const tbody = document.getElementById('table-alarm-tbody');
    if (!tbody) return;

    let items = state.allAlarms || [];
    if (state.activeAlarmFilter === '115') {
        items = items.filter(a => (a.pilar || '').includes('115'));
    } else if (state.activeAlarmFilter === '116') {
        items = items.filter(a => (a.pilar || '').includes('116'));
    } else if (state.activeAlarmFilter === 'Belum') {
        items = items.filter(a => (a.ack || '').toLowerCase().includes('belum'));
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-500">Tidak ada event alarm yang cocok dengan filter.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/80 hover:bg-slate-800/40 text-xs text-slate-300 transition-colors';
        const isUnack = (item.ack || '').toLowerCase().includes('belum');
        tr.innerHTML = `
            <td class="py-2.5 px-3.5 font-mono text-slate-400 whitespace-nowrap">${item.waktu}</td>
            <td class="py-2.5 px-3.5 font-semibold text-cyan-400 whitespace-nowrap">${item.pilar}</td>
            <td class="py-2.5 px-3.5 text-rose-300 font-medium">${item.jenis}</td>
            <td class="py-2.5 px-3.5"><span class="${item.a1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.a1}</span></td>
            <td class="py-2.5 px-3.5"><span class="${item.a2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.a2}</span></td>
            <td class="py-2.5 px-3.5"><span class="${item.b1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.b1}</span></td>
            <td class="py-2.5 px-3.5"><span class="${item.b2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.b2}</span></td>
            <td class="py-2.5 px-3.5 font-mono text-slate-400 whitespace-nowrap">${item.latar}</td>
            <td class="py-2.5 px-3.5 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${isUnack ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                    ${item.ack}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Fetch recent 50 alarms
async function loadRecentAlarms(force = false) {
    try {
        const tbody = document.getElementById('table-alarm-tbody');
        if (tbody && (force || !state.allAlarms.length)) {
            tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-500">Memuat event alarm...</td></tr>';
        }

        const res = await fetch('/api/dashboard/alarms');
        const json = await res.json();
        if (json.status === 'success') {
            state.allAlarms = json.data || [];
            renderAlarmTable();
        }
    } catch (e) {
        console.error('Error fetching recent alarms:', e);
    }
}

// ==========================================
// HISTORIS LOGIC (Exact Image 1 Reproduction)
// ==========================================
function initHistorisCalendar() {
    const dateInput = document.getElementById('historis-date-picker');
    if (dateInput) {
        dateInput.value = state.selectedDate;
        dateInput.addEventListener('change', (e) => {
            state.selectedDate = e.target.value;
            loadHistorisVehicles(state.selectedDate);
        });
    }

    // Calendar grid quick day click
    const dayCells = document.querySelectorAll('[data-cal-day]');
    dayCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const day = cell.getAttribute('data-cal-day');
            dayCells.forEach(c => c.classList.remove('bg-blue-600', 'text-white', 'font-bold'));
            cell.classList.add('bg-blue-600', 'text-white', 'font-bold');

            const formattedDate = `2025-11-${day.padStart(2, '0')}`;
            state.selectedDate = formattedDate;
            if (dateInput) dateInput.value = formattedDate;
            loadHistorisVehicles(formattedDate);
        });
    });

    const btnTampilProfile = document.getElementById('btn-tampil-profile');
    if (btnTampilProfile) {
        btnTampilProfile.addEventListener('click', () => {
            if (state.selectedIdk) {
                loadHistorisProfile(state.selectedIdk);
            } else {
                showToast('Pilih kendaraan dari Vehicle List terlebih dahulu', 'warning');
            }
        });
    }

    const btnOkupasiData = document.getElementById('btn-okupasi-data');
    if (btnOkupasiData) {
        btnOkupasiData.addEventListener('click', () => {
            loadHistorisVehicles(state.selectedDate);
        });
    }

    const btnPrintPdf = document.getElementById('btn-print-pdf');
    if (btnPrintPdf) {
        btnPrintPdf.addEventListener('click', () => {
            window.print();
        });
    }
}

async function loadHistorisVehicles(dateStr) {
    try {
        const tbody = document.getElementById('vehicle-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400">Memuat data tanggal ${dateStr}...</td></tr>`;

        const res = await fetch(`/api/historis/vehicles?date=${dateStr}`);
        const json = await res.json();

        if (json.status === 'success' && json.data.length > 0) {
            tbody.innerHTML = '';
            json.data.forEach((v, idx) => {
                const tr = document.createElement('tr');
                tr.className = `border-b border-slate-700/60 hover:bg-blue-900/30 cursor-pointer text-xs transition-colors ${v.idk === state.selectedIdk ? 'bg-blue-900/50 text-cyan-300 font-semibold' : 'text-slate-300'}`;
                tr.setAttribute('data-idk', v.idk);
                tr.innerHTML = `
                    <td class="py-1.5 px-2 text-center text-slate-400">${v.no}</td>
                    <td class="py-1.5 px-2 text-center">
                        <button class="px-2 py-0.5 bg-slate-700 hover:bg-cyan-600 text-[10px] rounded text-white font-mono">Detail</button>
                    </td>
                    <td class="py-1.5 px-2 font-mono font-bold">${v.idk}</td>
                    <td class="py-1.5 px-2 font-mono text-slate-400">${v.tgl}</td>
                `;

                tr.addEventListener('click', () => {
                    document.querySelectorAll('#vehicle-list-tbody tr').forEach(row => {
                        row.classList.remove('bg-blue-900/50', 'text-cyan-300', 'font-semibold');
                    });
                    tr.classList.add('bg-blue-900/50', 'text-cyan-300', 'font-semibold');
                    state.selectedIdk = v.idk;
                    loadHistorisProfile(v.idk);
                });

                tbody.appendChild(tr);
            });

            // Automatically load first record if none selected or not in list
            const firstIdk = json.data[0].idk;
            if (!state.selectedIdk || !json.data.some(x => x.idk === state.selectedIdk)) {
                state.selectedIdk = firstIdk;
            }
            loadHistorisProfile(state.selectedIdk);
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">Tidak ada data kendaraan pada tanggal ini.</td></tr>`;
        }
    } catch (e) {
        console.error('Error fetching vehicles:', e);
    }
}

async function loadHistorisProfile(idk) {
    try {
        state.selectedIdk = idk;

        // 1. Update Camera 01 Vehicle Snapshot image
        const imgEl = document.getElementById('vehicle-snapshot-img');
        const imgBannerTime = document.getElementById('camera-timestamp-overlay');
        if (imgEl) {
            imgEl.src = `/api/historis/snapshot/${idk}?t=${Date.now()}`;
        }
        if (imgBannerTime) {
            // format timestamp from IDK: YYMMDDHHMMSS -> MM-DD-YYYY HH:MM:SS
            if (idk.length >= 12) {
                const yy = '20' + idk.substr(0, 2);
                const mm = idk.substr(2, 2);
                const dd = idk.substr(4, 2);
                const hh = idk.substr(6, 2);
                const mi = idk.substr(8, 2);
                const ss = idk.substr(10, 2);
                imgBannerTime.textContent = `${mm}-${dd}-${yy} ${hh}:${mi}:${ss} Camera 01`;
            } else {
                imgBannerTime.textContent = `IDK: ${idk} Camera 01`;
            }
        }

        // 2. Fetch profile data points
        const res = await fetch(`/api/historis/profile/${idk}`);
        const json = await res.json();

        if (json.status === 'success') {
            const data = json.data;

            // Render Detailed Data Grid (Bottom Table in Image 1)
            const gridTbody = document.getElementById('profile-grid-tbody');
            if (gridTbody) {
                gridTbody.innerHTML = '';
                (data.table_data || []).forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-slate-700/50 hover:bg-slate-700/30 text-xs font-mono text-slate-200';
                    tr.innerHTML = `
                        <td class="py-1 px-2.5 font-bold text-cyan-400 bg-blue-950/40">${row.IDK}</td>
                        <td class="py-1 px-2.5 text-slate-400">${row.TANGGAL}</td>
                        <td class="py-1 px-2.5 font-bold text-blue-400">${row.A1}</td>
                        <td class="py-1 px-2.5 font-bold text-emerald-400">${row.A2}</td>
                        <td class="py-1 px-2.5 font-bold text-yellow-400">${row.B1}</td>
                        <td class="py-1 px-2.5 font-bold text-rose-400">${row.B2}</td>
                        <td class="py-1 px-2.5 text-slate-400">${row.latarA1 || '-'}</td>
                        <td class="py-1 px-2.5 text-slate-400">${row.latarA2 || '-'}</td>
                    `;
                    gridTbody.appendChild(tr);
                });
            }

            // Render 4-line Profile Chart (Matching Image 1: Blue, Green, Yellow, Red)
            const profileCtx = document.getElementById('chart-profile-lines');
            if (profileCtx && data.chart_data) {
                if (state.charts.profile) state.charts.profile.destroy();

                state.charts.profile = new Chart(profileCtx, {
                    type: 'line',
                    data: {
                        labels: data.chart_data.labels,
                        datasets: [
                            {
                                label: 'Profil_A1',
                                data: data.chart_data.profil_a1,
                                borderColor: '#2563EB', // Blue
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_A2',
                                data: data.chart_data.profil_a2,
                                borderColor: '#16A34A', // Green
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_B1',
                                data: data.chart_data.profil_b1,
                                borderColor: '#EAB308', // Yellow
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_B2',
                                data: data.chart_data.profil_b2,
                                borderColor: '#DC2626', // Red
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                align: 'end',
                                labels: {
                                    boxWidth: 14,
                                    color: '#E2E8F0',
                                    font: { size: 11, weight: '600' }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(71, 85, 105, 0.4)' },
                                ticks: { color: '#94A3B8', stepSize: 10 }
                            },
                            y: {
                                min: 0,
                                max: 1600,
                                ticks: { stepSize: 200, color: '#94A3B8' },
                                grid: { color: 'rgba(71, 85, 105, 0.4)' }
                            }
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error fetching profile:', e);
    }
}

// ==========================================
// DATABASE SWITCHER & SYSTEM
// ==========================================
function initDatabaseSwitcher() {
    const dbSelect = document.getElementById('db-selector-dropdown');
    if (dbSelect) {
        dbSelect.addEventListener('change', async (e) => {
            const chosenDb = e.target.value;
            try {
                const res = await fetch('/api/system/select-db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ database: chosenDb })
                });
                const json = await res.json();
                if (json.status === 'success') {
                    showToast(json.message, 'success');
                    state.activeDb = chosenDb;
                    loadDashboardStats();
                    loadDashboardCharts();
                    loadRecentAlarms();
                }
            } catch (err) {
                showToast('Gagal mengubah database', 'error');
            }
        });
    }
}

async function loadSystemStatus() {
    try {
        const res = await fetch('/api/system/status');
        const json = await res.json();
        if (json.status === 'success') {
            const data = json.data;
            const statusBox = document.getElementById('system-status-container');
            if (statusBox) {
                let dbsHtml = '';
                data.databases.forEach(db => {
                    dbsHtml += `
                        <div class="flex justify-between items-center py-2 border-b border-slate-800 text-sm">
                            <div>
                                <span class="font-mono font-bold ${db.is_active ? 'text-cyan-400' : 'text-slate-300'}">${db.name}</span>
                                <span class="text-xs text-slate-500 ml-2">(${db.size_mb} MB)</span>
                                ${db.is_active ? '<span class="ml-2 px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-bold">AKTIF</span>' : ''}
                            </div>
                            <div class="text-xs text-slate-400">${db.status}</div>
                        </div>
                    `;
                });

                statusBox.innerHTML = `
                    <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
                        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h3 class="text-base font-bold text-white">Status Koneksi Folder Lokal (D:\\CAS_OPERATOR)</h3>
                                <p class="text-xs text-slate-400 mt-1">Sistem beroperasi dalam mode proteksi <strong class="text-emerald-400">READ-ONLY</strong></p>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-semibold ${data.cas_operator_accessible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                                ${data.cas_operator_accessible ? 'TERHUBUNG (ONLINE)' : 'TERPUTUS'}
                            </span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                            <div class="bg-slate-800/40 p-4 rounded-lg border border-slate-800">
                                <span class="text-xs text-slate-400">Path Direktori</span>
                                <p class="font-mono text-xs text-cyan-300 mt-1 font-bold">${data.cas_operator_path}</p>
                            </div>
                            <div class="bg-slate-800/40 p-4 rounded-lg border border-slate-800">
                                <span class="text-xs text-slate-400">PHP Environment</span>
                                <p class="font-mono text-xs text-slate-200 mt-1">${data.php_version} (${data.framework})</p>
                            </div>
                            <div class="bg-slate-800/40 p-4 rounded-lg border border-slate-800">
                                <span class="text-xs text-slate-400">Proteksi Keamanan</span>
                                <p class="font-mono text-xs text-emerald-400 mt-1">Strict Read-Only Mode (Active)</p>
                            </div>
                        </div>

                        <h4 class="text-sm font-semibold text-slate-200 mb-2">Daftar File Database Lokal:</h4>
                        <div class="bg-slate-950/60 rounded-lg p-3 border border-slate-800/80">
                            ${dbsHtml}
                        </div>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error('Error loading system status:', e);
    }
}

async function loadAlarmPage() {
    loadRecentAlarms();
}
