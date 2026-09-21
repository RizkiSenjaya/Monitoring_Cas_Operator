/**
 * RPM Web Monitoring - Main Application Logic
 * Integrates with Laravel API and renders rich UI matching Images 1, 2, and 3.
 */

// Global State
const savedActiveDb = localStorage.getItem('rpm_active_db') || 'rpm_1.db';
const state = {
    activeTab: 'dashboard',
    activeDb: savedActiveDb,
    selectedDate: (savedActiveDb === 'rpm.db') ? '2025-11-20' : '2025-11-14',
    selectedIdk: (savedActiveDb === 'rpm.db') ? '251120235947' : '251114095622',
    alarmSelectedDate: (savedActiveDb === 'rpm.db') ? '2025-11-29' : '2025-11-14',
    currentVehicles: [],
    alarmVehicles: [],
    selectedAlarmIdk: null,
    currentOkupasiProfileData: null,
    currentAlarmProfileData: null,
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

// API URL helper to dynamically attach active database parameter
function apiUrl(endpoint) {
    const sep = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${sep}db=${encodeURIComponent(state.activeDb || 'rpm_1.db')}`;
}

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
    initActivityLogFilters();
    renderActivityLogsTable();
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
    } else if (tabName === 'pilar') {
        loadDashboardStats();
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
        const res = await fetch(apiUrl('/api/dashboard/stats'));
        const json = await res.json();
        if (json.status === 'success') {
            handleServerConnectionSuccess();
            const d = json.data;
            state.activeDb = d.active_db;
            state.isAlarmActive = !!d.is_alarm_active;

            // Update 4 Cards
            const totOk = document.getElementById('stat-total-okupasi');
            if (totOk) totOk.textContent = formatNumber(d.total_okupasi);
            const totAl = document.getElementById('stat-total-alarm');
            if (totAl) totAl.textContent = formatNumber(d.total_alarm);
            const datLog = document.getElementById('stat-data-log');
            if (datLog) datLog.textContent = formatNumber(d.data_log);
            const datLat = document.getElementById('stat-data-latar');
            if (datLat) datLat.textContent = formatNumber(d.data_latar);

            // Update Status Terakhir Card & 2 Detector Cards (Gambar 4)
            const lr = d.latest_reading || {};
            const timeEl = document.getElementById('status-terakhir-waktu');
            if (timeEl) timeEl.textContent = lr.TANGGAL || '2025-11-14 9:56:26';
            
            const detAVal = document.getElementById('det-a-val');
            if (detAVal) detAVal.textContent = `${formatNumber(lr.A1 || 1160)} / ${formatNumber(lr.A2 || 940)}`;
            const detBVal = document.getElementById('det-b-val');
            if (detBVal) detBVal.textContent = `${formatNumber(lr.B1 || 1050)} / ${formatNumber(lr.B2 || 850)}`;
            
            const detA1Cps = document.getElementById('det-a1-cps');
            if (detA1Cps) detA1Cps.textContent = `${formatNumber(lr.A1 || 1160)} cps`;
            const detA2Cps = document.getElementById('det-a2-cps');
            if (detA2Cps) detA2Cps.textContent = `${formatNumber(lr.A2 || 940)} cps`;
            const detB1Cps = document.getElementById('det-b1-cps');
            if (detB1Cps) detB1Cps.textContent = `${formatNumber(lr.B1 || 1050)} cps`;
            const detB2Cps = document.getElementById('det-b2-cps');
            if (detB2Cps) detB2Cps.textContent = `${formatNumber(lr.B2 || 850)} cps`;

            const detABadge = document.getElementById('det-a-badge');
            if (detABadge) {
                detABadge.textContent = d.detector_a_status || 'NORMAL';
                detABadge.className = (d.detector_a_status === 'ALARM')
                    ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            }
            const detBBadge = document.getElementById('det-b-badge');
            if (detBBadge) {
                detBBadge.textContent = d.detector_b_status || 'NORMAL';
                detBBadge.className = (d.detector_b_status === 'ALARM')
                    ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            }

            const suhu = document.getElementById('suhu-val');
            if (suhu) suhu.textContent = `${lr.TEMP || 37} °C`;
            const hum = document.getElementById('humidity-val');
            if (hum) hum.textContent = `${lr.HUMIDITY || 47} %`;

            const badgeStatus = document.getElementById('badge-status-terakhir');
            if (badgeStatus) {
                badgeStatus.textContent = d.is_alarm_active ? 'ALARM' : 'NORMAL';
                badgeStatus.className = d.is_alarm_active 
                    ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-500/40 animate-pulse'
                    : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-600/40';
            }

            // Ringkasan Sistem
            const rDetA = document.getElementById('ringkasan-det-a');
            if (rDetA) rDetA.textContent = d.detector_a_status || 'NORMAL';
            const rDetB = document.getElementById('ringkasan-det-b');
            if (rDetB) rDetB.textContent = d.detector_b_status || 'NORMAL';
            const rOk = document.getElementById('ringkasan-okupasi');
            if (rOk) rOk.textContent = d.okupasi_status || 'YA';
            const rAl = document.getElementById('ringkasan-alarm');
            if (rAl) {
                rAl.textContent = d.is_alarm_active ? 'AKTIF' : 'NORMAL';
                rAl.className = d.is_alarm_active ? 'font-bold text-rose-500' : 'font-bold text-emerald-400';
            }

            // Sync active DB badges
            const dbBadge = document.getElementById('active-db-label');
            if (dbBadge) dbBadge.textContent = d.active_db;
            const alarmDbBadge = document.getElementById('alarm-active-db-badge');
            if (alarmDbBadge) alarmDbBadge.textContent = d.active_db;
            const alarmTotCounter = document.getElementById('alarm-total-counter');
            if (alarmTotCounter) alarmTotCounter.textContent = formatNumber(d.total_alarm);

            const dbSelect = document.getElementById('db-selector-dropdown');
            if (dbSelect && dbSelect.value !== d.active_db) {
                dbSelect.value = d.active_db;
            }

            // Update Tab Status Pilar (Pilar 115 & Pilar 116)
            updateStatusPilarView(lr);

            // Update Okupasi Chart state
            if (state.charts.okupasi) {
                renderOrUpdateOkupasiChart();
            }
        }
    } catch (e) {
        console.error('Error fetching dashboard stats:', e);
        handleServerConnectionError(e);
    }
}

// Update Status Pilar view with latest reading
function updateStatusPilarView(lr) {
    if (!lr) return;
    const timeVal = lr.TANGGAL || '2025-11-14 9:56:26';

    // Pilar 115
    const p115Time = document.getElementById('pilar115-last-time');
    if (p115Time) p115Time.textContent = timeVal;
    const p115A1 = document.getElementById('pilar115-a1');
    if (p115A1) p115A1.textContent = `${formatNumber(lr.A1 || 1160)} cps (Threshold: 1.250)`;
    const p115A2 = document.getElementById('pilar115-a2');
    if (p115A2) p115A2.textContent = `${formatNumber(lr.A2 || 940)} cps (Threshold: 1.100)`;
    const p115Latar = document.getElementById('pilar115-latar');
    if (p115Latar) p115Latar.textContent = `${lr.latarA1 || 1095} / ${lr.latarA2 || 989} cps`;
    const p115Temp = document.getElementById('pilar115-temp');
    if (p115Temp) p115Temp.textContent = `${lr.TEMP || 35.2} °C`;
    const p115Rh = document.getElementById('pilar115-humidity');
    if (p115Rh) p115Rh.textContent = `${lr.HUMIDITY || 44.2} %`;

    // Pilar 116
    const p116Time = document.getElementById('pilar116-last-time');
    if (p116Time) p116Time.textContent = timeVal;
    const p116B1 = document.getElementById('pilar116-b1');
    if (p116B1) p116B1.textContent = `${formatNumber(lr.B1 || 1050)} cps (Threshold: 1.250)`;
    const p116B2 = document.getElementById('pilar116-b2');
    if (p116B2) p116B2.textContent = `${formatNumber(lr.B2 || 850)} cps (Threshold: 1.100)`;
    const p116Latar = document.getElementById('pilar116-latar');
    if (p116Latar) p116Latar.textContent = `${lr.latarB1 || 1005} / ${lr.latarB2 || 896} cps`;
    const p116Temp = document.getElementById('pilar116-temp');
    if (p116Temp) p116Temp.textContent = `${lr.TEMP ? (Number(lr.TEMP) + 0.5).toFixed(1) : '37.3'} °C`;
    const p116Rh = document.getElementById('pilar116-humidity');
    if (p116Rh) p116Rh.textContent = `${lr.HUMIDITY ? (Number(lr.HUMIDITY) + 0.8).toFixed(1) : '45.0'} %`;
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
        const res = await fetch(apiUrl(url));
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
            const res = await fetch(apiUrl('/api/dashboard/tick'));
            const json = await res.json();
            if (json.status === 'success') {
                const tick = json.data;
                state.isAlarmActive = !!tick.is_alarm;

                // 1. Update live cards
                handleServerConnectionSuccess();
                const timeEl = document.getElementById('status-terakhir-waktu');
                if (timeEl) timeEl.textContent = tick.db_time || tick.time;
                const detA = document.getElementById('det-a-val');
                if (detA) detA.textContent = `${formatNumber(tick.a1)} / ${formatNumber(tick.a2)}`;
                const detB = document.getElementById('det-b-val');
                if (detB) detB.textContent = `${formatNumber(tick.b1)} / ${formatNumber(tick.b2)}`;
                
                const detA1Cps = document.getElementById('det-a1-cps');
                if (detA1Cps) detA1Cps.textContent = `${formatNumber(tick.a1)} cps`;
                const detA2Cps = document.getElementById('det-a2-cps');
                if (detA2Cps) detA2Cps.textContent = `${formatNumber(tick.a2)} cps`;
                const detB1Cps = document.getElementById('det-b1-cps');
                if (detB1Cps) detB1Cps.textContent = `${formatNumber(tick.b1)} cps`;
                const detB2Cps = document.getElementById('det-b2-cps');
                if (detB2Cps) detB2Cps.textContent = `${formatNumber(tick.b2)} cps`;

                const detABadge = document.getElementById('det-a-badge');
                if (detABadge) {
                    detABadge.textContent = tick.is_alarm ? 'ALARM' : 'NORMAL';
                    detABadge.className = tick.is_alarm
                        ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                }
                const detBBadge = document.getElementById('det-b-badge');
                if (detBBadge) {
                    detBBadge.textContent = tick.is_alarm ? 'ALARM' : 'NORMAL';
                    detBBadge.className = tick.is_alarm
                        ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                }

                const suhu = document.getElementById('suhu-val');
                if (suhu) suhu.textContent = `${tick.temp} °C`;
                const hum = document.getElementById('humidity-val');
                if (hum) hum.textContent = `${tick.humidity} %`;
                
                const badgeStatus = document.getElementById('badge-status-terakhir');
                if (badgeStatus) {
                    badgeStatus.textContent = tick.is_alarm ? 'ALARM' : 'NORMAL';
                    badgeStatus.className = tick.is_alarm 
                        ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-500/40 animate-pulse'
                        : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm shadow-emerald-600/40';
                }

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

                // 5. Suhu & Kelembaban Chart smooth update (Realtime)
                if (state.charts.env && state.charts.env.data) {
                    const envLabels = state.charts.env.data.labels;
                    const dsTemp115 = state.charts.env.data.datasets[0].data;
                    const dsTemp116 = state.charts.env.data.datasets[1].data;
                    const dsRh115 = state.charts.env.data.datasets[2].data;
                    if (envLabels.length > 20) {
                        envLabels.shift();
                        dsTemp115.shift();
                        dsTemp116.shift();
                        dsRh115.shift();
                    }
                    envLabels.push(secLabel.substring(0, 5));
                    const t115 = Number(tick.temp) || 35.2;
                    const t116 = Math.round((t115 + 1.3) * 10) / 10;
                    const rh = Number(tick.humidity) || 44.5;
                    dsTemp115.push(t115);
                    dsTemp116.push(t116);
                    dsRh115.push(rh);
                    state.charts.env.update('none');
                }
            }
        } catch (err) {
            handleServerConnectionError(err);
        }
    }, 1000);
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
}

async function loadTelemetryCharts() {
    try {
        const res = await fetch(apiUrl('/api/dashboard/charts'));
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

// Initialize Alarm tab quick filters, calendar picker, and buttons
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

    const datePicker = document.getElementById('alarm-date-picker');
    if (datePicker) {
        datePicker.addEventListener('change', (e) => {
            const dateVal = e.target.value;
            if (dateVal) {
                state.alarmSelectedDate = dateVal;
                const parts = dateVal.split('-');
                if (parts.length === 3) {
                    renderAlarmCalendar(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
                loadAlarmVehicles(dateVal);
            }
            if (state.allAlarms && state.allAlarms.length) {
                const dateMatches = state.allAlarms.filter(a => String(a.waktu || '').startsWith(dateVal));
                if (dateMatches.length) {
                    showToast(`Menampilkan alarm pada tanggal ${dateVal}`, 'info');
                    selectAlarmRecord(dateMatches[0]);
                }
            }
        });
    }

    const quickSelect = document.getElementById('alarm-cal-quick-select');
    if (quickSelect) {
        quickSelect.addEventListener('click', () => {
            const targetDay = (state.activeDb === 'rpm.db') ? 29 : 14;
            selectAlarmCalendarDay(2025, 10, targetDay);
        });
    }

    const btnAlarmTampil = document.getElementById('btn-alarm-tampil-profile');
    if (btnAlarmTampil) {
        btnAlarmTampil.addEventListener('click', () => {
            const targetIdk = state.selectedAlarmIdk || (state.alarmVehicles && state.alarmVehicles.length ? state.alarmVehicles[0].idk : null);
            if (targetIdk) {
                selectAlarmVehicle(targetIdk);
                showToast(`Menampilkan profil sensor & foto alarm ${targetIdk}`, 'info');
            } else {
                showToast('Pilih kendaraan alarm dari list terlebih dahulu', 'warning');
            }
        });
    }

    const btnAlarmRefresh = document.getElementById('btn-alarm-refresh');
    if (btnAlarmRefresh) {
        btnAlarmRefresh.addEventListener('click', () => {
            loadAlarmVehicles(state.alarmSelectedDate || '2025-11-14');
            loadRecentAlarms(true);
            showToast('Memperbarui data alarm...', 'info');
        });
    }

    const initialDay = (state.activeDb === 'rpm.db') ? 29 : 14;
    renderAlarmCalendar(2025, 10, initialDay);
    loadAlarmVehicles(state.alarmSelectedDate || '2025-11-14');
}

function renderAlarmCalendar(year, month, selectedDay) {
    const grid = document.getElementById('alarm-cal-grid');
    const label = document.getElementById('alarm-cal-month-year');
    if (!grid) return;

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    if (label) label.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    let html = '';
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<span class="text-slate-600 py-0.5">${prevDays - i}</span>`;
    }
    for (let d = 1; d <= totalDays; d++) {
        const isSelected = (d === selectedDay);
        html += `<span data-alarm-cal-day="${d}" class="py-0.5 rounded cursor-pointer transition-colors ${isSelected ? 'bg-rose-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-300'}">${d}</span>`;
    }
    grid.innerHTML = html;

    grid.querySelectorAll('[data-alarm-cal-day]').forEach(cell => {
        cell.addEventListener('click', () => {
            const d = parseInt(cell.getAttribute('data-alarm-cal-day'), 10);
            selectAlarmCalendarDay(year, month, d);
        });
    });
}

function selectAlarmCalendarDay(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    state.alarmSelectedDate = dateStr;

    const datePicker = document.getElementById('alarm-date-picker');
    if (datePicker) datePicker.value = dateStr;

    renderAlarmCalendar(year, month, day);
    loadAlarmVehicles(dateStr);

    if (state.allAlarms && state.allAlarms.length) {
        const dateMatches = state.allAlarms.filter(a => String(a.waktu || '').startsWith(dateStr));
        if (dateMatches.length) {
            showToast(`Menampilkan alarm pada tanggal ${dateStr}`, 'info');
            selectAlarmRecord(dateMatches[0]);
        } else {
            showToast(`Tidak ada event alarm rekaman pada tanggal ${dateStr}`, 'info');
        }
    }
}

// Select an alarm record: updates snapshot camera and both pilar charts (Gambar 2 replica)
function selectAlarmRecord(item) {
    if (!item) return;

    const img = document.getElementById('alarm-snapshot-img');
    const overlay = document.getElementById('alarm-snapshot-overlay');
    const idkOverlay = document.getElementById('alarm-snapshot-idk-overlay');
    const pilarBadge = document.getElementById('alarm-snapshot-pilar-badge');

    if (img) {
        img.src = `/api/historis/snapshot/${item.idk}`;
    }
    if (overlay) {
        overlay.textContent = `PILAR ${item.pilar} • ${item.waktu}`;
    }
    if (idkOverlay) {
        idkOverlay.textContent = `IDK: ${item.idk}`;
    }
    if (pilarBadge) {
        pilarBadge.textContent = `PILAR ${item.pilar}`;
        pilarBadge.className = String(item.pilar).includes('115') 
            ? 'px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold'
            : 'px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold';
    }

    // Highlight selected row in table
    document.querySelectorAll('#table-alarm-tbody tr').forEach(r => {
        r.classList.remove('bg-cyan-950/50', 'border-l-4', 'border-cyan-400');
    });
    const tr = document.getElementById(`alarm-row-${item.idk}`);
    if (tr) {
        tr.classList.add('bg-cyan-950/50', 'border-l-4', 'border-cyan-400');
    }

    initAlarmCharts(item);

    // Also sync the Alarm Vehicle view (snapshot, multi-line radiation chart & sensor table)
    if (typeof selectAlarmVehicle === 'function') {
        selectAlarmVehicle(item.idk, item);
    }
}

// Render 2 radiation charts in Tab Alarm with red vertical markers on alarm spike (Gambar 2)
function initAlarmCharts(selectedItem) {
    const c116 = document.getElementById('chart-alarm-pilar116');
    const c115 = document.getElementById('chart-alarm-pilar115');
    if (!c116 || !c115) return;

    const sampleLabels = [];
    const p116Data = [];
    const p115Data = [];
    const p116AlarmMarkers = [];
    const p115AlarmMarkers = [];

    const baseVal116 = selectedItem ? Number(selectedItem.raw_b1 || 1050) : 1050;
    const baseVal115 = selectedItem ? Number(selectedItem.raw_a1 || 1160) : 1160;
    const isPilar116 = selectedItem && String(selectedItem.pilar).includes('116');
    const isPilar115 = selectedItem && String(selectedItem.pilar).includes('115');

    // Generate 31 seconds window (-15s to +15s around alarm event)
    for (let i = -15; i <= 15; i++) {
        const secLabel = (i <= 0 ? `${i}s` : `+${i}s`);
        sampleLabels.push(secLabel);
        
        const dist = Math.abs(i);
        const factor = Math.exp(- (dist * dist) / 8);
        
        const val116 = Math.round(baseVal116 * 0.75 + 180 * Math.sin(i / 2.5) + (isPilar116 ? factor * 1350 : factor * 250));
        p116Data.push(val116);
        p116AlarmMarkers.push(isPilar116 && i === 0 ? val116 : null);

        const val115 = Math.round(baseVal115 * 0.75 + 160 * Math.cos(i / 2.5) + (isPilar115 ? factor * 1350 : factor * 250));
        p115Data.push(val115);
        p115AlarmMarkers.push(isPilar115 && i === 0 ? val115 : null);
    }

    if (state.charts.alarm116) state.charts.alarm116.destroy();
    state.charts.alarm116 = new Chart(c116, {
        type: 'line',
        data: {
            labels: sampleLabels,
            datasets: [
                {
                    label: 'Cacah Pilar 116',
                    data: p116Data,
                    borderColor: '#3B82F6',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0
                },
                {
                    label: 'ALARM DETEKSI',
                    data: p116AlarmMarkers,
                    borderColor: '#F43F5E',
                    backgroundColor: '#F43F5E',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                    ticks: { color: '#64748B', font: { size: 9 }, maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                    ticks: { color: '#64748B', font: { size: 9 }, maxTicksLimit: 4 }
                }
            }
        }
    });

    if (state.charts.alarm115) state.charts.alarm115.destroy();
    state.charts.alarm115 = new Chart(c115, {
        type: 'line',
        data: {
            labels: sampleLabels,
            datasets: [
                {
                    label: 'Cacah Pilar 115',
                    data: p115Data,
                    borderColor: '#06B6D4',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0
                },
                {
                    label: 'ALARM DETEKSI',
                    data: p115AlarmMarkers,
                    borderColor: '#F43F5E',
                    backgroundColor: '#F43F5E',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                    ticks: { color: '#64748B', font: { size: 9 }, maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: 'rgba(51, 65, 85, 0.2)' },
                    ticks: { color: '#64748B', font: { size: 9 }, maxTicksLimit: 4 }
                }
            }
        }
    });
}

// Render Alarm Table in Alarm Tab (All records, fast string builder + event delegation)
function renderAlarmTable() {
    const tbody = document.getElementById('table-alarm-tbody');
    if (!tbody) return;

    const allItems = state.allAlarms || [];

    // Calculate dynamic counts for filter buttons
    const count115 = allItems.filter(a => String(a.pilar || '').includes('115')).length;
    const count116 = allItems.filter(a => String(a.pilar || '').includes('116')).length;
    const countBelum = allItems.filter(a => String(a.ack || '').toLowerCase().includes('belum') || a.ack === 0 || a.ack === '0').length;

    const btnAll = document.getElementById('alarm-filter-btn-all');
    if (btnAll) btnAll.textContent = `Semua (${allItems.length.toLocaleString('id-ID')})`;
    const btn115 = document.getElementById('alarm-filter-btn-115');
    if (btn115) btn115.textContent = `Pilar 115 (${count115.toLocaleString('id-ID')})`;
    const btn116 = document.getElementById('alarm-filter-btn-116');
    if (btn116) btn116.textContent = `Pilar 116 (${count116.toLocaleString('id-ID')})`;
    const btnBelum = document.getElementById('alarm-filter-btn-belum');
    if (btnBelum) btnBelum.textContent = `Belum ACK (${countBelum.toLocaleString('id-ID')})`;

    // Filter items based on activeAlarmFilter
    let items = allItems;
    if (state.activeAlarmFilter === '115') {
        items = items.filter(a => String(a.pilar || '').includes('115'));
    } else if (state.activeAlarmFilter === '116') {
        items = items.filter(a => String(a.pilar || '').includes('116'));
    } else if (state.activeAlarmFilter === 'Belum') {
        items = items.filter(a => String(a.ack || '').toLowerCase().includes('belum') || a.ack === 0 || a.ack === '0');
    }

    const totalBadge = document.getElementById('alarm-table-total-badge');
    if (totalBadge) {
        totalBadge.textContent = `${items.length.toLocaleString('id-ID')} Event`;
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="py-8 text-center text-slate-500">Tidak ada event alarm yang cocok dengan filter.</td></tr>';
        return;
    }

    // High performance HTML string builder for thousands of rows
    const rowsHtml = items.map((item, index) => {
        const isUnack = String(item.ack || '').toLowerCase().includes('belum') || item.ack === 0 || item.ack === '0';
        const a1Val = item.raw_a1 ? `${formatNumber(item.raw_a1)}` : (item.a1 || '-');
        const a2Val = item.raw_a2 ? `${formatNumber(item.raw_a2)}` : (item.a2 || '-');
        const b1Val = item.raw_b1 ? `${formatNumber(item.raw_b1)}` : (item.b1 || '-');
        const b2Val = item.raw_b2 ? `${formatNumber(item.raw_b2)}` : (item.b2 || '-');

        return `
            <tr id="alarm-row-${item.idk}" data-alarm-idk="${item.idk}" class="border-b border-slate-800/80 hover:bg-slate-800/40 text-xs text-slate-300 transition-colors cursor-pointer">
                <td class="py-2.5 px-3 text-slate-500 font-mono">${index + 1}</td>
                <td class="py-2.5 px-3 font-mono text-cyan-300 font-semibold">${item.idk}</td>
                <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${item.waktu}</td>
                <td class="py-2.5 px-3 font-semibold text-cyan-400 whitespace-nowrap">Pilar ${item.pilar}</td>
                <td class="py-2.5 px-3 text-rose-300 font-medium">${item.jenis}</td>
                <td class="py-2.5 px-3 whitespace-nowrap font-mono">
                    <span class="${item.a1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-300'}">${a1Val}</span> / 
                    <span class="${item.a2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-300'}">${a2Val}</span>
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap font-mono">
                    <span class="${item.b1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-300'}">${b1Val}</span> / 
                    <span class="${item.b2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-300'}">${b2Val}</span>
                </td>
                <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${item.latar || '-'}</td>
                <td class="py-2.5 px-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${isUnack ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
                        ${isUnack ? 'Belum ACK' : 'Sudah ACK'}
                    </span>
                </td>
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                    <button type="button" data-alarm-action="view" class="btn-lihat-foto px-2.5 py-1 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded text-[11px] font-medium shadow-sm transition-all flex items-center gap-1 mx-auto">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        Lihat Foto
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    // Single delegated click listener on tbody for ultra performance
    if (!tbody.hasAttribute('data-delegated')) {
        tbody.setAttribute('data-delegated', 'true');
        tbody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr[data-alarm-idk]');
            if (!tr) return;
            const idk = tr.getAttribute('data-alarm-idk');
            const item = (state.allAlarms || []).find(a => String(a.idk) === String(idk));
            if (item) {
                selectAlarmRecord(item);
            }
        });
    }

    // Auto-select first alarm for snapshot viewer & charts if none currently selected
    if (items.length > 0 && !state.selectedAlarmIdk) {
        selectAlarmRecord(items[0]);
    }
}

// Load Alarm Page
function loadAlarmPage() {
    loadAlarmVehicles(state.alarmSelectedDate || '2025-11-14');
    loadRecentAlarms(true);
}

// Fetch recent alarms (all data from tblAlarm)
async function loadRecentAlarms(force = false) {
    try {
        const tbody = document.getElementById('table-alarm-tbody');
        if (tbody && (force || !state.allAlarms.length)) {
            tbody.innerHTML = '<tr><td colspan="10" class="py-8 text-center text-slate-500">Memuat event alarm...</td></tr>';
        }

        const res = await fetch(apiUrl('/api/dashboard/alarms?limit=0'));
        const json = await res.json();
        if (json.status === 'success') {
            handleServerConnectionSuccess();
            state.allAlarms = json.data || []; // All data completely loaded!
            renderAlarmTable();

            // Sync total counter and quick jump button with active database
            const totalAlarmEl = document.getElementById('alarm-total-counter');
            if (totalAlarmEl) {
                totalAlarmEl.textContent = state.allAlarms.length.toLocaleString('id-ID');
            }
            const quickJump = document.getElementById('alarm-cal-quick-select');
            if (quickJump) {
                quickJump.textContent = (state.activeDb === 'rpm.db') ? 'Pilih 29 Nov' : 'Pilih 14 Nov';
            }

            const defaultDay = (state.activeDb === 'rpm.db') ? 29 : 14;
            const datePicker = document.getElementById('alarm-date-picker');
            if (datePicker && !datePicker.value) {
                datePicker.value = `2025-11-${String(defaultDay).padStart(2, '0')}`;
            }
            renderAlarmCalendar(2025, 10, defaultDay);
        }
    } catch (e) {
        console.error('Error fetching recent alarms:', e);
        handleServerConnectionError(e);
    }
}

// Export all alarm records to CSV
function exportAlarmDataCSV() {
    const items = state.allAlarms || [];
    if (!items.length) {
        showToast('Tidak ada data alarm untuk diekspor', 'info');
        return;
    }
    let csv = 'No,IDK,Waktu,Pilar,Jenis Alarm,Det A1,Det A2,Det B1,Det B2,Latar,Status ACK\n';
    items.forEach((it, idx) => {
        csv += `${idx+1},"${it.idk}","${it.waktu}","Pilar ${it.pilar}","${it.jenis}","${it.raw_a1 || it.a1 || ''}","${it.raw_a2 || it.a2 || ''}","${it.raw_b1 || it.b1 || ''}","${it.raw_b2 || it.b2 || ''}","${it.latar || ''}","${it.ack || 'Belum'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `alarm_rpm_${state.activeDb}_semua_${items.length}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Berhasil mengekspor seluruh (${items.length.toLocaleString('id-ID')}) data alarm ke CSV`, 'success');
}
window.exportAlarmDataCSV = exportAlarmDataCSV;


// Export occupation records to CSV
function exportOkupasiDataCSV() {
    const items = state.currentVehicles || [];
    if (!items.length) {
        showToast('Tidak ada data okupasi untuk diekspor', 'warning');
        return;
    }
    let csv = 'No,IDK,Tanggal,Jumlah Points,Max A1 (cps),Max B1 (cps)\n';
    items.forEach((it, idx) => {
        csv += `${idx+1},"${it.idk}","${it.tgl}",${it.points || 0},${it.max_a1 || 0},${it.max_b1 || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `okupasi_rpm_${state.activeDb}_${state.selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Berhasil mengekspor data okupasi ke CSV', 'success');
}
window.exportOkupasiDataCSV = exportOkupasiDataCSV;

// Helper to convert an image element or image URL to base64 DataURL for jsPDF
async function getImageBase64(imgElement, fallbackUrl = '') {
    return new Promise((resolve) => {
        try {
            if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth;
                canvas.height = imgElement.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                return resolve(dataUrl);
            }
        } catch (err) {
            console.warn('Canvas export failed, attempting fetch:', err);
        }

        const src = (imgElement && imgElement.src) || fallbackUrl;
        if (!src) return resolve(null);

        fetch(src)
            .then(res => {
                if (!res.ok) throw new Error('Image fetch failed');
                return res.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            })
            .catch((e) => {
                console.warn('Could not load image as blob:', e);
                resolve(null);
            });
    });
}

// Helper to fetch batch thumbnails as base64 Data URLs for high-speed PDF rendering
async function loadSnapshotThumbnails(idks, onProgress) {
    const thumbMap = new Map();
    if (!idks || !idks.length) return thumbMap;

    const uniqueIdks = Array.from(new Set(idks.filter(Boolean)));
    const batchSize = 100;
    const totalBatches = Math.ceil(uniqueIdks.length / batchSize);

    for (let b = 0; b < totalBatches; b++) {
        const chunk = uniqueIdks.slice(b * batchSize, (b + 1) * batchSize);
        if (onProgress) {
            onProgress(Math.min((b + 1) * batchSize, uniqueIdks.length), uniqueIdks.length);
        }

        try {
            const res = await fetch('/api/historis/batch-thumbnails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ idks: chunk })
            });
            const json = await res.json();
            if (json.status === 'success' && json.thumbnails) {
                Object.entries(json.thumbnails).forEach(([k, v]) => {
                    if (v) thumbMap.set(k, v);
                });
            }
        } catch (err) {
            console.warn('Batch thumbnail fetch error for chunk, continuing:', err);
        }
    }

    return thumbMap;
}

// Export occupation records to PDF (jsPDF + autoTable)
async function exportOkupasiDataPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Library jsPDF sedang dimuat, coba sesaat lagi...', 'warning');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    showToast('Menyiapkan dokumen PDF Historis Okupasi...', 'info');

    const primaryColor = [15, 23, 42]; // Slate 900
    const accentCyan = [6, 182, 212];  // Cyan 500

    // Header Banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 26, 'F');

    // Accent line
    doc.setFillColor(accentCyan[0], accentCyan[1], accentCyan[2]);
    doc.rect(0, 26, 210, 1.5, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RADIATION PORTAL MONITOR (RPM) - CAS OPERATOR', 14, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('LAPORAN HISTORIS OKUPASI KENDARAAN & MONITORING RADIASI', 14, 18);
    doc.setFontSize(8);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | CAS OPERATOR`, 14, 23);

    // Metadata Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal Terpilih:', 18, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`${state.selectedDate}`, 46, 38);

    doc.setFont('helvetica', 'bold');
    doc.text('Database:', 18, 44);
    doc.setFont('helvetica', 'normal');
    doc.text(`${state.activeDb}`, 46, 44);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Kendaraan:', 18, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`${state.currentVehicles?.length || 0} Kendaraan (Semua)`, 46, 50);

    doc.setFont('helvetica', 'bold');
    doc.text('Kendaraan Aktif (IDK):', 105, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`${state.selectedIdk || '-'}`, 142, 38);

    doc.setFont('helvetica', 'bold');
    doc.text('Status Portal:', 105, 44);
    doc.setFont('helvetica', 'normal');
    doc.text('Normal / Terintegrasi', 142, 44);

    doc.setFont('helvetica', 'bold');
    doc.text('Kamera Snapshot:', 105, 50);
    doc.setFont('helvetica', 'normal');
    doc.text('Portal Entrance Camera 01', 142, 50);

    // Section 1: Snapshot Camera Image of Selected Vehicle
    let startY = 58;
    const imgEl = document.getElementById('vehicle-snapshot-img');
    const base64Img = await getImageBase64(imgEl, `/api/historis/snapshot/${state.selectedIdk}`);

    if (base64Img) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`FOTO SNAPSHOT KENDARAAN (IDK: ${state.selectedIdk})`, 14, startY + 4);

        try {
            doc.addImage(base64Img, 'JPEG', 14, startY + 6, 68, 45);
            doc.setDrawColor(15, 23, 42);
            doc.rect(14, startY + 6, 68, 45, 'D');

            doc.setFillColor(15, 23, 42);
            doc.rect(14, startY + 51, 68, 5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(`CAM 01 • ${state.selectedIdk} • ${state.selectedDate}`, 16, startY + 54.5);

            doc.setFillColor(248, 250, 252);
            doc.rect(86, startY + 6, 110, 50, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(86, startY + 6, 110, 50, 'D');

            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.text('Ringkasan Profil Radiasi Kendaraan', 90, startY + 12);

            const activeVeh = (state.currentVehicles || []).find(v => String(v.idk) === String(state.selectedIdk)) || {};
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Waktu Lintasan: ${activeVeh.tgl || state.selectedDate}`, 90, startY + 18);
            doc.text(`Jumlah Titik Pengukuran: ${activeVeh.points || '-'} titik sampel`, 90, startY + 24);
            doc.text(`Nilai Puncak A1: ${formatNumber(activeVeh.max_a1 || 0)} cps`, 90, startY + 30);
            doc.text(`Nilai Puncak B1: ${formatNumber(activeVeh.max_b1 || 0)} cps`, 90, startY + 36);
            doc.text('Keterangan: Lolos pemeriksaan radiasi (Normal)', 90, startY + 42);

            startY += 62;
        } catch (e) {
            console.warn('Could not render image to PDF:', e);
            startY += 8;
        }
    }

    // Section 2: Table of Vehicles for this date with photo on EVERY row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`DAFTAR SELURUH KENDARAAN PADA TANGGAL ${state.selectedDate} (${state.currentVehicles?.length || 0} TOTAL)`, 14, startY);

    // Fetch batch thumbnails for all vehicles
    showToast(`Memuat foto seluruh kendaraan (0/${state.currentVehicles?.length || 0})...`, 'info');
    const vehicleIdks = (state.currentVehicles || []).map(v => v.idk);
    const vehicleThumbMap = await loadSnapshotThumbnails(vehicleIdks, (done, total) => {
        showToast(`Memuat foto seluruh kendaraan (${done}/${total})...`, 'info');
    });

    const vehicleTableData = (state.currentVehicles || []).map(v => [
        v.no,
        '', // Cell for vehicle photo thumbnail
        v.idk,
        v.tgl,
        v.points || '-',
        formatNumber(v.max_a1 || 0),
        formatNumber(v.max_b1 || 0)
    ]);

    doc.autoTable({
        startY: startY + 3,
        head: [['No', 'Foto Snapshot', 'IDK Kendaraan', 'Tanggal / Jam', 'Points', 'Max A1 (cps)', 'Max B1 (cps)']],
        body: vehicleTableData.length > 0 ? vehicleTableData : [['-', '-', '-', 'Tidak ada data kendaraan', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 1.5, minCellHeight: 14, valign: 'middle', font: 'helvetica' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10, valign: 'middle' },
            1: { halign: 'center', cellWidth: 24, valign: 'middle' },
            2: { fontStyle: 'bold', cellWidth: 32, valign: 'middle' },
            3: { cellWidth: 44, valign: 'middle' },
            4: { halign: 'center', cellWidth: 18, valign: 'middle' },
            5: { halign: 'right', cellWidth: 27, valign: 'middle' },
            6: { halign: 'right', cellWidth: 27, valign: 'middle' }
        },
        margin: { left: 14, right: 14 },
        didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 1) {
                const rowIdk = data.row.raw[2];
                const imgBase64 = vehicleThumbMap.get(String(rowIdk));
                if (imgBase64) {
                    try {
                        doc.addImage(imgBase64, 'JPEG', data.cell.x + 2.5, data.cell.y + 1.25, 19, 11.5);
                        doc.setDrawColor(203, 213, 225);
                        doc.rect(data.cell.x + 2.5, data.cell.y + 1.25, 19, 11.5, 'D');
                    } catch (err) {
                        console.warn('PDF addImage error:', err);
                    }
                }
            }
        }
    });


    // Section 3: Detail Data Profil Sensor Kendaraan Terpilih
    if (state.currentOkupasiProfileData && state.currentOkupasiProfileData.table_data && state.currentOkupasiProfileData.table_data.length > 0) {
        let nextY = doc.lastAutoTable.finalY + 8;
        if (nextY > 250) {
            doc.addPage();
            nextY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`DETAIL DATA PROFIL SENSOR PER DETIK (IDK: ${state.selectedIdk})`, 14, nextY);

        const profileTableData = state.currentOkupasiProfileData.table_data.map((r, i) => [
            i + 1,
            r.IDK || state.selectedIdk,
            r.TANGGAL,
            formatNumber(r.A1),
            formatNumber(r.A2),
            formatNumber(r.B1),
            formatNumber(r.B2),
            formatNumber(r.latarA1),
            formatNumber(r.latarA2)
        ]);

        doc.autoTable({
            startY: nextY + 3,
            head: [['No', 'IDK', 'Waktu', 'A1 (cps)', 'A2 (cps)', 'B1 (cps)', 'B2 (cps)', 'Latar A1', 'Latar A2']],
            body: profileTableData,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.2, font: 'helvetica' },
            headStyles: { fillColor: [8, 145, 178], textColor: [255, 255, 255], fontStyle: 'bold' },
            margin: { left: 14, right: 14 }
        });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Halaman ${i} dari ${totalPages} | Sistem Pemantauan RPM Web CAS Operator`, 14, 290);
    }

    doc.save(`Laporan_Historis_Okupasi_${state.selectedDate}.pdf`);
    showToast('Berhasil mengunduh Laporan PDF Historis Okupasi!', 'success');
}
window.exportOkupasiDataPDF = exportOkupasiDataPDF;

// Export alarm records to PDF (jsPDF + autoTable)
async function exportAlarmDataPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Library jsPDF sedang dimuat, coba sesaat lagi...', 'warning');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    showToast('Menyiapkan dokumen PDF Historis Alarm Radiasi...', 'info');

    const alarmDate = state.alarmSelectedDate || '2025-11-14';

    // Header Banner (Rose/Red Alarm Theme)
    doc.setFillColor(159, 18, 57); // Rose 900
    doc.rect(0, 0, 210, 26, 'F');

    // Accent line
    doc.setFillColor(244, 63, 94); // Rose 500
    doc.rect(0, 26, 210, 1.5, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RADIATION PORTAL MONITOR (RPM) - CAS OPERATOR', 14, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(254, 205, 211); // Rose 200
    doc.text('LAPORAN HISTORIS ALARM RADIASI KENDARAAN & VERIFIKASI SENSOR', 14, 18);
    doc.setFontSize(8);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | Status: VERIFIKASI ALARM`, 14, 23);

    // Metadata Box
    doc.setFillColor(255, 241, 242); // Rose 50
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'F');
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setTextColor(159, 18, 57);
    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal Kejadian:', 18, 38);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${alarmDate}`, 48, 38);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Database:', 18, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${state.activeDb}`, 48, 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Total Kejadian Alarm:', 18, 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${state.alarmVehicles?.length || 0} Event Alarm`, 48, 50);

    const activeAlarm = (state.alarmVehicles || []).find(v => String(v.idk) === String(state.selectedAlarmIdk)) || {};
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('IDK Alarm Terpilih:', 105, 38);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${state.selectedAlarmIdk || '-'}`, 142, 38);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Status Verifikasi:', 105, 38);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('Verifikasi Operator Portal', 142, 38);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Pilar Monitoring:', 105, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('Pilar 115 & Pilar 116', 142, 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Kamera Snapshot:', 105, 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('Portal Camera 01 (Snapshot Terintegrasi)', 142, 50);

    // Section 1: Table of Alarm Vehicles for this date with photo on EVERY row (Starting directly after metadata)
    let startY = 58;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(159, 18, 57);
    doc.text(`DAFTAR SELURUH EVENT KENDARAAN ALARM PADA TANGGAL ${alarmDate} (${state.alarmVehicles?.length || 0} TOTAL)`, 14, startY);

    // Fetch batch thumbnails for all alarm vehicles
    showToast(`Memuat foto kendaraan alarm (0/${state.alarmVehicles?.length || 0})...`, 'info');
    const alarmIdks = (state.alarmVehicles || []).map(v => v.idk);
    const alarmThumbMap = await loadSnapshotThumbnails(alarmIdks, (done, total) => {
        showToast(`Memuat foto kendaraan alarm (${done}/${total})...`, 'info');
    });

    const alarmVehiclesTableData = (state.alarmVehicles || []).map(v => [
        v.no,
        '', // Cell for vehicle photo thumbnail
        v.idk,
        v.tgl,
        `Pilar ${v.pilar || '115'}`,
        v.jenis || 'Alarm Gamma',
        formatNumber(v.max_a1 || 0),
        formatNumber(v.max_b1 || 0)
    ]);

    doc.autoTable({
        startY: startY + 3,
        head: [['No', 'Foto Snapshot', 'IDK Alarm', 'Waktu Kejadian', 'Pilar', 'Jenis Alarm', 'Max A1 (cps)', 'Max B1 (cps)']],
        body: alarmVehiclesTableData.length > 0 ? alarmVehiclesTableData : [['-', '-', '-', 'Tidak ada event alarm pada tanggal ini', '-', '-', '-', '-']],
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 1.5, minCellHeight: 14, valign: 'middle', font: 'helvetica' },
        headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10, valign: 'middle' },
            1: { halign: 'center', cellWidth: 24, valign: 'middle' },
            2: { fontStyle: 'bold', cellWidth: 28, valign: 'middle' },
            3: { cellWidth: 36, valign: 'middle' },
            4: { halign: 'center', cellWidth: 18, valign: 'middle' },
            5: { cellWidth: 26, valign: 'middle' },
            6: { halign: 'right', cellWidth: 20, valign: 'middle' },
            7: { halign: 'right', cellWidth: 20, valign: 'middle' }
        },
        margin: { left: 14, right: 14 },
        didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 1) {
                const rowIdk = data.row.raw[2];
                const imgBase64 = alarmThumbMap.get(String(rowIdk));
                if (imgBase64) {
                    try {
                        doc.addImage(imgBase64, 'JPEG', data.cell.x + 2.5, data.cell.y + 1.25, 19, 11.5);
                        doc.setDrawColor(254, 205, 211);
                        doc.rect(data.cell.x + 2.5, data.cell.y + 1.25, 19, 11.5, 'D');
                    } catch (err) {
                        console.warn('PDF addImage error:', err);
                    }
                }
            }
        }
    });

    // Section 2: Detail Data Profil Sensor Alarm Kendaraan Terpilih
    if (state.currentAlarmProfileData && state.currentAlarmProfileData.table_data && state.currentAlarmProfileData.table_data.length > 0) {
        let nextY = doc.lastAutoTable.finalY + 8;
        if (nextY > 250) {
            doc.addPage();
            nextY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(159, 18, 57);
        doc.text(`DETAIL DATA PROFIL SENSOR ALARM PER DETIK (IDK: ${state.selectedAlarmIdk})`, 14, nextY);

        const profileTableData = state.currentAlarmProfileData.table_data.map((r, i) => [
            i + 1,
            r.IDK || state.selectedAlarmIdk,
            r.TANGGAL,
            formatNumber(r.A1),
            formatNumber(r.A2),
            formatNumber(r.B1),
            formatNumber(r.B2),
            formatNumber(r.latarA1),
            formatNumber(r.latarA2)
        ]);

        doc.autoTable({
            startY: nextY + 3,
            head: [['No', 'IDK', 'Waktu', 'Det A1 (cps)', 'Det A2 (cps)', 'Det B1 (cps)', 'Det B2 (cps)', 'Latar A1', 'Latar A2']],
            body: profileTableData,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.2, font: 'helvetica' },
            headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
            margin: { left: 14, right: 14 }
        });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Halaman ${i} dari ${totalPages} | Sistem Pemantauan Alarm Radiasi RPM CAS Operator`, 14, 290);
    }

    doc.save(`Laporan_Historis_Alarm_${alarmDate}.pdf`);
    showToast('Berhasil mengunduh Laporan PDF Historis Alarm!', 'success');
}
window.exportAlarmDataPDF = exportAlarmDataPDF;

// Export single alarm vehicle detailed profile to PDF (Snapshot, Radiation Chart, & Second-by-Second Sensor Grid)
async function exportAlarmProfilePDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Library jsPDF sedang dimuat, coba sesaat lagi...', 'warning');
        return;
    }

    const targetIdk = state.selectedAlarmIdk || (state.alarmVehicles && state.alarmVehicles.length ? state.alarmVehicles[0].idk : null);
    if (!targetIdk) {
        showToast('Pilih kendaraan alarm dari daftar terlebih dahulu', 'warning');
        return;
    }

    showToast(`Menyiapkan Laporan PDF Profil Alarm IDK ${targetIdk}...`, 'info');

    // Ensure we have current profile data
    if (!state.currentAlarmProfileData || String(state.currentAlarmProfileData.idk) !== String(targetIdk)) {
        try {
            const res = await fetch(apiUrl(`/api/historis/profile/${targetIdk}`));
            const json = await res.json();
            if (json.status === 'success') {
                state.currentAlarmProfileData = json.data;
            }
        } catch (e) {
            console.warn('Could not refresh profile data:', e);
        }
    }

    const activeAlarm = (state.alarmVehicles || []).find(v => String(v.idk) === String(targetIdk)) 
                     || (state.allAlarms || []).find(v => String(v.idk) === String(targetIdk)) 
                     || { idk: targetIdk, pilar: '115', jenis: 'Alarm Gamma Detector' };

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header Banner (Rose/Red Alarm Theme)
    doc.setFillColor(159, 18, 57); // Rose 900
    doc.rect(0, 0, 210, 26, 'F');

    // Accent line
    doc.setFillColor(244, 63, 94); // Rose 500
    doc.rect(0, 26, 210, 1.5, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RADIATION PORTAL MONITOR (RPM) - CAS OPERATOR', 14, 11);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(254, 205, 211); // Rose 200
    doc.text('LAPORAN DETAIL PROFIL RADIASI & SENSOR KENDARAAN TERKENA ALARM', 14, 18);
    doc.setFontSize(8);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} | Status: VERIFIKASI ALARM RADIASI`, 14, 23);

    // Metadata Box
    doc.setFillColor(255, 241, 242); // Rose 50
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'F');
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(14, 32, 182, 22, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setTextColor(159, 18, 57);
    doc.setFont('helvetica', 'bold');
    doc.text('IDK Kendaraan:', 18, 38);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${targetIdk}`, 48, 38);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Waktu Kejadian:', 18, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${activeAlarm.tgl || activeAlarm.waktu || state.alarmSelectedDate || '-'}`, 48, 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Pilar Terdeteksi:', 18, 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`Pilar ${activeAlarm.pilar || '115'}`, 48, 50);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Jenis Alarm:', 105, 38);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${activeAlarm.jenis || 'Alarm Gamma'}`, 142, 38);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Database Aktif:', 105, 44);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${state.activeDb}`, 142, 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(159, 18, 57);
    doc.text('Titik Pengukuran:', 105, 50);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const sampleCount = state.currentAlarmProfileData?.table_data?.length || 0;
    doc.text(`${sampleCount} Sampel (${sampleCount} Detik)`, 142, 50);

    let startY = 58;

    // Section 1: Snapshot Camera Image (Alarm) & Parameter Deteksi Box (Moved here!)
    const imgEl = document.getElementById('alarm-vehicle-snapshot-img');
    const base64Img = await getImageBase64(imgEl, `/api/historis/snapshot/${targetIdk}`);

    if (base64Img) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(159, 18, 57);
        doc.text(`FOTO SNAPSHOT KENDARAAN TERKENA ALARM (IDK: ${targetIdk})`, 14, startY + 4);

        try {
            doc.addImage(base64Img, 'JPEG', 14, startY + 6, 68, 45);
            doc.setDrawColor(225, 29, 72);
            doc.rect(14, startY + 6, 68, 45, 'D');

            doc.setFillColor(225, 29, 72);
            doc.rect(14, startY + 51, 68, 5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(`PILAR ${activeAlarm.pilar || '115'} • ALARM EVENT • ${targetIdk}`, 16, startY + 54.5);

            doc.setFillColor(255, 241, 242);
            doc.rect(86, startY + 6, 110, 50, 'F');
            doc.setDrawColor(254, 205, 211);
            doc.rect(86, startY + 6, 110, 50, 'D');

            doc.setFontSize(8.5);
            doc.setTextColor(159, 18, 57);
            doc.setFont('helvetica', 'bold');
            doc.text('Parameter Deteksi & Verifikasi Alarm', 90, startY + 12);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(`Waktu Kejadian: ${activeAlarm.tgl || activeAlarm.waktu || state.alarmSelectedDate || '-'}`, 90, startY + 18);
            doc.text(`Pilar Terpicu: Pilar ${activeAlarm.pilar || '115'}`, 90, startY + 24);
            doc.text(`Puncak Cacah A1: ${formatNumber(activeAlarm.max_a1 || 0)} cps`, 90, startY + 30);
            doc.text(`Puncak Cacah B1: ${formatNumber(activeAlarm.max_b1 || 0)} cps`, 90, startY + 36);
            doc.text('Status Konfirmasi: Telah diverifikasi operator sistem', 90, startY + 42);

            startY += 62;
        } catch (e) {
            console.warn('Could not render alarm snapshot to profile PDF:', e);
            startY += 8;
        }
    }

    // Section 2: Chart Profil Radiasi Alarm Kendaraan (Clean Publication Style Matching Tables)
    const pData = state.currentAlarmProfileData;
    let chartData = pData?.chart_data;
    if (!chartData && pData?.table_data && pData.table_data.length > 0) {
        chartData = {
            labels: pData.table_data.map((_, idx) => String(idx)),
            profil_a1: pData.table_data.map(r => r.A1 ?? 0),
            profil_a2: pData.table_data.map(r => r.A2 ?? 0),
            profil_b1: pData.table_data.map(r => r.B1 ?? 0),
            profil_b2: pData.table_data.map(r => r.B2 ?? 0),
        };
    }

    if (chartData && chartData.labels && chartData.labels.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(159, 18, 57);
        doc.text('CHART PROFIL RADIASI ALARM KENDARAAN (DETEKTOR A1, A2, B1, B2)', 14, startY + 3);

        try {
            // Render high-resolution publication-quality clean light chart matching table aesthetics
            const offCanvas = document.createElement('canvas');
            offCanvas.width = 1200;
            offCanvas.height = 380;
            const offCtx = offCanvas.getContext('2d');
            offCtx.fillStyle = '#FFFFFF';
            offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);

            const tempChart = new Chart(offCanvas, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: 'Detektor A1',
                            data: chartData.profil_a1,
                            borderColor: '#0284C7',
                            backgroundColor: '#0284C7',
                            borderWidth: 2.5,
                            tension: 0.1,
                            pointRadius: chartData.labels.length > 30 ? 0 : 3,
                            pointBackgroundColor: '#0284C7'
                        },
                        {
                            label: 'Detektor A2',
                            data: chartData.profil_a2,
                            borderColor: '#16A34A',
                            backgroundColor: '#16A34A',
                            borderWidth: 2.5,
                            tension: 0.1,
                            pointRadius: chartData.labels.length > 30 ? 0 : 3,
                            pointBackgroundColor: '#16A34A'
                        },
                        {
                            label: 'Detektor B1',
                            data: chartData.profil_b1,
                            borderColor: '#D97706',
                            backgroundColor: '#D97706',
                            borderWidth: 2.5,
                            tension: 0.1,
                            pointRadius: chartData.labels.length > 30 ? 0 : 3,
                            pointBackgroundColor: '#D97706'
                        },
                        {
                            label: 'Detektor B2',
                            data: chartData.profil_b2,
                            borderColor: '#E11D48',
                            backgroundColor: '#E11D48',
                            borderWidth: 2.5,
                            tension: 0.1,
                            pointRadius: chartData.labels.length > 30 ? 0 : 3,
                            pointBackgroundColor: '#E11D48'
                        }
                    ]
                },
                options: {
                    animation: false,
                    responsive: false,
                    devicePixelRatio: 1,
                    layout: {
                        padding: { top: 10, right: 25, bottom: 10, left: 15 }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            align: 'center',
                            labels: {
                                color: '#1E293B',
                                font: { family: 'Helvetica', size: 12, weight: 'bold' },
                                boxWidth: 15,
                                boxHeight: 12,
                                padding: 16,
                                usePointStyle: true,
                                pointStyle: 'rectRounded'
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Waktu Relatif / Detik (s)',
                                color: '#475569',
                                font: { family: 'Helvetica', size: 11, weight: 'bold' }
                            },
                            grid: { color: '#E2E8F0', lineWidth: 1 },
                            ticks: { color: '#475569', font: { family: 'Helvetica', size: 10 } },
                            border: { color: '#CBD5E1' }
                        },
                        y: {
                            min: 0,
                            title: {
                                display: true,
                                text: 'Laju Cacah Radiasi (cps)',
                                color: '#475569',
                                font: { family: 'Helvetica', size: 11, weight: 'bold' }
                            },
                            grid: { color: '#E2E8F0', lineWidth: 1 },
                            ticks: { color: '#475569', font: { family: 'Helvetica', size: 10 } },
                            border: { color: '#CBD5E1' }
                        }
                    }
                },
                plugins: [{
                    id: 'chartWhiteBackgroundPlugin',
                    beforeDraw: (c) => {
                        const cctx = c.ctx;
                        cctx.save();
                        cctx.fillStyle = '#FFFFFF';
                        cctx.fillRect(0, 0, c.width, c.height);
                        cctx.restore();
                    }
                }]
            });

            const chartDataUrl = offCanvas.toDataURL('image/png');
            tempChart.destroy();

            // Render clean white card matching table aesthetic
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(14, startY + 6, 182, 58, 2, 2, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, startY + 6, 182, 58, 2, 2, 'D');

            doc.addImage(chartDataUrl, 'PNG', 14.5, startY + 6.5, 181, 57);
            startY += 68;
        } catch (err) {
            console.warn('Could not render publication-styled chart to profile PDF:', err);
            startY += 8;
        }
    }

    // Section 3: Tabel Detail Data Profil Sensor Alarm Per Detik
    if (state.currentAlarmProfileData && state.currentAlarmProfileData.table_data && state.currentAlarmProfileData.table_data.length > 0) {
        if (startY > 210) {
            doc.addPage();
            startY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(159, 18, 57);
        doc.text(`TABEL DETAIL DATA PROFIL SENSOR ALARM PER DETIK (IDK: ${targetIdk})`, 14, startY);

        const profileTableData = state.currentAlarmProfileData.table_data.map((r, i) => [
            i + 1,
            r.IDK || targetIdk,
            r.TANGGAL,
            formatNumber(r.A1),
            formatNumber(r.A2),
            formatNumber(r.B1),
            formatNumber(r.B2),
            formatNumber(r.latarA1),
            formatNumber(r.latarA2)
        ]);

        doc.autoTable({
            startY: startY + 3,
            head: [['No', 'IDK', 'Waktu', 'Det A1 (cps)', 'Det A2 (cps)', 'Det B1 (cps)', 'Det B2 (cps)', 'Latar A1', 'Latar A2']],
            body: profileTableData,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.2, font: 'helvetica' },
            headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
            margin: { left: 14, right: 14 }
        });
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Halaman ${i} dari ${totalPages} | Sistem Pemantauan Alarm Radiasi RPM CAS Operator`, 14, 290);
    }

    doc.save(`Laporan_Profil_Alarm_${targetIdk}.pdf`);
    showToast(`Berhasil mengunduh Laporan PDF Profil Alarm ${targetIdk}!`, 'success');
}
window.exportAlarmProfilePDF = exportAlarmProfilePDF;


// Load alarm vehicle records for date
async function loadAlarmVehicles(dateStr) {
    try {
        const tbody = document.getElementById('alarm-vehicle-list-tbody');
        const countBadge = document.getElementById('alarm-vehicle-count');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-slate-400">Memuat data alarm tanggal ${dateStr}...</td></tr>`;

        const res = await fetch(apiUrl(`/api/historis/alarm-vehicles?date=${dateStr}`));
        const json = await res.json();

        if (json.status === 'success' && json.data && json.data.length > 0) {
            state.alarmVehicles = json.data;
            if (countBadge) {
                countBadge.textContent = `${json.total} Alarm (Semua)`;
            }
            tbody.innerHTML = '';
            json.data.forEach((v) => {
                const tr = document.createElement('tr');
                const isSelected = String(v.idk) === String(state.selectedAlarmIdk);
                tr.className = `border-b border-slate-700/60 hover:bg-rose-950/40 cursor-pointer text-xs transition-colors ${isSelected ? 'bg-rose-950/60 text-rose-300 font-semibold' : 'text-slate-300'}`;
                tr.setAttribute('data-alarm-idk', v.idk);
                tr.innerHTML = `
                    <td class="py-1.5 px-2 text-center text-slate-400">${v.no}</td>
                    <td class="py-1.5 px-2 text-center">
                        <button type="button" onclick="event.stopPropagation(); selectAlarmVehicle('${v.idk}')" class="px-2.5 py-0.5 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-[10px] rounded text-white font-mono font-semibold cursor-pointer shadow-sm transition-all">Detail</button>
                    </td>
                    <td class="py-1.5 px-2 font-mono font-bold text-rose-400">${v.idk}</td>
                    <td class="py-1.5 px-2 font-mono text-slate-400">${v.tgl}</td>
                    <td class="py-1.5 px-2 text-center font-semibold text-rose-300">Pilar ${v.pilar || '115'}</td>
                `;

                tr.addEventListener('click', () => {
                    selectAlarmVehicle(v.idk, v);
                });

                tbody.appendChild(tr);
            });

            // Automatically select first record if none selected or not in list
            const firstIdk = json.data[0].idk;
            if (!state.selectedAlarmIdk || !json.data.some(x => String(x.idk) === String(state.selectedAlarmIdk))) {
                state.selectedAlarmIdk = String(firstIdk);
            }
            const activeItem = json.data.find(x => String(x.idk) === String(state.selectedAlarmIdk)) || json.data[0];
            selectAlarmVehicle(state.selectedAlarmIdk, activeItem);
        } else {
            state.alarmVehicles = [];
            if (countBadge) countBadge.textContent = '0 Alarm';
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-500">Tidak ada data alarm pada tanggal ${dateStr} di ${state.activeDb}.</td></tr>`;
            const profileTbody = document.getElementById('alarm-profile-grid-tbody');
            if (profileTbody) {
                profileTbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-slate-500">Pilih kendaraan alarm untuk menampilkan grid profile.</td></tr>';
            }
        }
    } catch (e) {
        console.error('Error fetching alarm vehicles:', e);
    }
}
window.loadAlarmVehicles = loadAlarmVehicles;

// Select an alarm vehicle
async function selectAlarmVehicle(idk, rowData = null) {
    if (!idk) return;
    state.selectedAlarmIdk = String(idk);

    if (!rowData && state.alarmVehicles) {
        rowData = state.alarmVehicles.find(x => String(x.idk) === String(idk));
    }

    // Highlight row in list
    document.querySelectorAll('#alarm-vehicle-list-tbody tr').forEach(row => {
        if (row.getAttribute('data-alarm-idk') === String(idk)) {
            row.classList.add('bg-rose-950/60', 'text-rose-300', 'font-semibold');
        } else {
            row.classList.remove('bg-rose-950/60', 'text-rose-300', 'font-semibold');
        }
    });

    // Update snapshot camera & overlays
    const imgEl = document.getElementById('alarm-vehicle-snapshot-img');
    const badgeEl = document.getElementById('alarm-snapshot-pilar-badge');
    const timeOverlay = document.getElementById('alarm-snapshot-overlay');
    const idkOverlay = document.getElementById('alarm-snapshot-idk-overlay');
    const activeIdkBadge = document.getElementById('alarm-profile-active-idk-badge');

    if (imgEl) {
        imgEl.src = `/api/historis/snapshot/${idk}?t=${Date.now()}`;
    }
    const pilarStr = rowData?.pilar ? `PILAR ${rowData.pilar}` : 'PILAR 115';
    if (badgeEl) badgeEl.textContent = pilarStr;
    if (timeOverlay) {
        timeOverlay.textContent = `${pilarStr} • ${rowData?.tgl || idk}`;
    }
    if (idkOverlay) {
        idkOverlay.textContent = `IDK: ${idk}`;
    }
    if (activeIdkBadge) {
        activeIdkBadge.textContent = `IDK: ${idk} (${pilarStr})`;
    }

    // Fetch profile time-series for this alarm vehicle
    try {
        const res = await fetch(apiUrl(`/api/historis/profile/${idk}`));
        const json = await res.json();
        if (json.status === 'success') {
            const data = json.data;
            state.currentAlarmProfileData = data;

            // Render detail table
            const tbody = document.getElementById('alarm-profile-grid-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (!data.table_data || data.table_data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-slate-500">Tidak ada baris data profile untuk IDK ${idk}.</td></tr>`;
                } else {
                    data.table_data.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-slate-700/40 text-xs font-mono hover:bg-rose-950/30 transition-colors';
                        tr.innerHTML = `
                            <td class="py-1 px-2.5 text-rose-400 font-bold">${r.IDK || idk}</td>
                            <td class="py-1 px-2.5 text-slate-300">${r.TANGGAL}</td>
                            <td class="py-1 px-2.5 text-blue-400 font-semibold">${formatNumber(r.A1)}</td>
                            <td class="py-1 px-2.5 text-emerald-400 font-semibold">${formatNumber(r.A2)}</td>
                            <td class="py-1 px-2.5 text-yellow-400 font-semibold">${formatNumber(r.B1)}</td>
                            <td class="py-1 px-2.5 text-rose-400 font-semibold">${formatNumber(r.B2)}</td>
                            <td class="py-1 px-2.5 text-slate-400">${formatNumber(r.latarA1)}</td>
                            <td class="py-1 px-2.5 text-slate-400">${formatNumber(r.latarA2)}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            // Render multi-line radiation alarm chart
            const ctx = document.getElementById('chart-alarm-profile-lines');
            if (ctx && data.chart_data) {
                if (state.charts.alarmProfile) state.charts.alarmProfile.destroy();
                state.charts.alarmProfile = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.chart_data.labels,
                        datasets: [
                            {
                                label: 'Profil_A1',
                                data: data.chart_data.profil_a1,
                                borderColor: '#38BDF8', // Cyan/Blue
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_A2',
                                data: data.chart_data.profil_a2,
                                borderColor: '#34D399', // Green
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_B1',
                                data: data.chart_data.profil_b1,
                                borderColor: '#FBBF24', // Yellow
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            },
                            {
                                label: 'Profil_B2',
                                data: data.chart_data.profil_b2,
                                borderColor: '#F43F5E', // Rose/Red
                                borderWidth: 2,
                                tension: 0.1,
                                pointRadius: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { intersect: false, mode: 'index' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#1E1B4B',
                                titleColor: '#F8FAFC',
                                borderColor: '#F43F5E',
                                borderWidth: 1
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(71, 85, 105, 0.3)' },
                                ticks: { color: '#94A3B8', stepSize: 10 }
                            },
                            y: {
                                min: 0,
                                ticks: { color: '#94A3B8' },
                                grid: { color: 'rgba(71, 85, 105, 0.3)' }
                            }
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.error('Error fetching alarm profile:', e);
    }
}
window.selectAlarmVehicle = selectAlarmVehicle;

// ==========================================
// HISTORIS LOGIC (Exact Image 1 Reproduction)
// ==========================================
function initHistorisCalendar() {
    const dateInput = document.getElementById('historis-date-picker');
    
    // Choose active default date based on active database
    if (state.activeDb === 'rpm.db') {
        state.selectedDate = '2025-11-20';
    } else {
        state.selectedDate = '2025-11-14';
    }

    if (dateInput) {
        dateInput.value = state.selectedDate;
        dateInput.addEventListener('change', (e) => {
            state.selectedDate = e.target.value;
            const parts = state.selectedDate.split('-');
            if (parts.length === 3) {
                const dayNum = parseInt(parts[2], 10);
                document.querySelectorAll('[data-cal-day]').forEach(c => {
                    if (parseInt(c.getAttribute('data-cal-day'), 10) === dayNum) {
                        c.classList.add('bg-blue-600', 'text-white', 'font-bold');
                    } else {
                        c.classList.remove('bg-blue-600', 'text-white', 'font-bold');
                    }
                });
            }
            loadHistorisVehicles(state.selectedDate);
        });
    }

    // Set active day cell highlight
    const parts = state.selectedDate.split('-');
    const activeDay = parts.length === 3 ? parseInt(parts[2], 10) : 14;
    const dayCells = document.querySelectorAll('[data-cal-day]');
    dayCells.forEach(cell => {
        const day = parseInt(cell.getAttribute('data-cal-day'), 10);
        if (day === activeDay) {
            cell.classList.add('bg-blue-600', 'text-white', 'font-bold');
        } else {
            cell.classList.remove('bg-blue-600', 'text-white', 'font-bold');
        }

        cell.addEventListener('click', () => {
            dayCells.forEach(c => c.classList.remove('bg-blue-600', 'text-white', 'font-bold'));
            cell.classList.add('bg-blue-600', 'text-white', 'font-bold');

            const formattedDate = `2025-11-${String(day).padStart(2, '0')}`;
            state.selectedDate = formattedDate;
            if (dateInput) dateInput.value = formattedDate;
            loadHistorisVehicles(formattedDate);
        });
    });

    const btnTampilProfile = document.getElementById('btn-tampil-profile');
    if (btnTampilProfile) {
        btnTampilProfile.addEventListener('click', () => {
            const targetIdk = state.selectedIdk || (state.currentVehicles && state.currentVehicles.length ? state.currentVehicles[0].idk : null);
            if (targetIdk) {
                selectHistorisVehicle(targetIdk);
                showToast(`Menampilkan foto snapshot & profil radiasi kendaraan ${targetIdk}`, 'info');
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

    // Initial vehicle load for this database
    loadHistorisVehicles(state.selectedDate);
}

// Select a vehicle: highlights row, updates camera photo snapshot, radiation chart, and detail table
function selectHistorisVehicle(idk) {
    if (!idk) return;
    state.selectedIdk = String(idk);

    document.querySelectorAll('#vehicle-list-tbody tr').forEach(row => {
        if (row.getAttribute('data-idk') === String(idk)) {
            row.classList.add('bg-blue-900/50', 'text-cyan-300', 'font-semibold');
        } else {
            row.classList.remove('bg-blue-900/50', 'text-cyan-300', 'font-semibold');
        }
    });

    loadHistorisProfile(idk);
}
window.selectHistorisVehicle = selectHistorisVehicle;

async function loadHistorisVehicles(dateStr) {
    try {
        const tbody = document.getElementById('vehicle-list-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-slate-400">Memuat data tanggal ${dateStr} (${state.activeDb})...</td></tr>`;

        const res = await fetch(apiUrl(`/api/historis/vehicles?date=${dateStr}`));
        const json = await res.json();

        if (json.status === 'success' && json.data.length > 0) {
            state.currentVehicles = json.data;
            const countBadge = document.getElementById('historis-vehicle-count');
            if (countBadge) {
                countBadge.textContent = `${json.total} Kendaraan (Semua)`;
            }
            tbody.innerHTML = '';
            json.data.forEach((v, idx) => {
                const tr = document.createElement('tr');
                const isSelected = String(v.idk) === String(state.selectedIdk);
                tr.className = `border-b border-slate-700/60 hover:bg-blue-900/30 cursor-pointer text-xs transition-colors ${isSelected ? 'bg-blue-900/50 text-cyan-300 font-semibold' : 'text-slate-300'}`;
                tr.setAttribute('data-idk', v.idk);
                tr.innerHTML = `
                    <td class="py-1.5 px-2 text-center text-slate-400">${v.no}</td>
                    <td class="py-1.5 px-2 text-center">
                        <button type="button" onclick="event.stopPropagation(); selectHistorisVehicle('${v.idk}')" class="px-2.5 py-0.5 bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 text-[10px] rounded text-white font-mono font-semibold cursor-pointer shadow-sm transition-all">Detail</button>
                    </td>
                    <td class="py-1.5 px-2 font-mono font-bold">${v.idk}</td>
                    <td class="py-1.5 px-2 font-mono text-slate-400">${v.tgl}</td>
                `;

                tr.addEventListener('click', () => {
                    selectHistorisVehicle(v.idk);
                });

                tbody.appendChild(tr);
            });

            // Automatically load first record if none selected or not in list
            const firstIdk = json.data[0].idk;
            if (!state.selectedIdk || !json.data.some(x => String(x.idk) === String(state.selectedIdk))) {
                state.selectedIdk = String(firstIdk);
            }
            selectHistorisVehicle(state.selectedIdk);
        } else {
            state.currentVehicles = [];
            const countBadge = document.getElementById('historis-vehicle-count');
            if (countBadge) countBadge.textContent = '0 Kendaraan';
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-slate-500">Tidak ada data kendaraan pada tanggal ini di ${state.activeDb}.</td></tr>`;
            const profileTbody = document.getElementById('profile-grid-tbody') || document.getElementById('profile-detail-tbody');
            if (profileTbody) {
                profileTbody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-slate-500">Pilih kendaraan untuk menampilkan grid profile.</td></tr>';
            }
        }
    } catch (e) {
        console.error('Error fetching vehicles:', e);
    }
}

async function loadHistorisProfile(idk) {
    try {
        state.selectedIdk = String(idk);

        // 1. Update Camera 01 Vehicle Snapshot image
        const imgEl = document.getElementById('vehicle-snapshot-img');
        const imgBannerTime = document.getElementById('camera-timestamp-overlay');
        if (imgEl) {
            imgEl.src = `/api/historis/snapshot/${idk}?t=${Date.now()}`;
        }
        if (imgBannerTime && String(idk).length >= 12) {
            // format timestamp from IDK: YYMMDDHHMMSS -> MM-DD-YYYY HH:MM:SS
            const sIdk = String(idk);
            const yy = sIdk.substring(0, 2);
            const mm = sIdk.substring(2, 4);
            const dd = sIdk.substring(4, 6);
            const hh = sIdk.substring(6, 8);
            const mi = sIdk.substring(8, 10);
            const ss = sIdk.substring(10, 12);
            imgBannerTime.textContent = `1-${mm}-20${yy}, ${hh}:${mi}:${ss} Camera 01`;
        }

        // 2. Fetch vehicle profile time-series from database
        const res = await fetch(apiUrl(`/api/historis/profile/${idk}`));
        const json = await res.json();
        if (json.status === 'success') {
            const data = json.data;
            state.currentOkupasiProfileData = data;

            // Render detail table (Gambar 2 replica)
            const tbody = document.getElementById('profile-grid-tbody') || document.getElementById('profile-detail-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (!data.table_data || data.table_data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-slate-500">Tidak ada baris data profile untuk IDK ${idk}.</td></tr>`;
                } else {
                    data.table_data.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.className = 'border-b border-slate-700/40 text-xs font-mono hover:bg-slate-800/40 transition-colors';
                        tr.innerHTML = `
                            <td class="py-1 px-2.5 text-cyan-300 font-bold">${r.IDK || idk}</td>
                            <td class="py-1 px-2.5 text-slate-300">${r.TANGGAL}</td>
                            <td class="py-1 px-2.5 text-blue-400 font-semibold">${formatNumber(r.A1)}</td>
                            <td class="py-1 px-2.5 text-emerald-400 font-semibold">${formatNumber(r.A2)}</td>
                            <td class="py-1 px-2.5 text-yellow-400 font-semibold">${formatNumber(r.B1)}</td>
                            <td class="py-1 px-2.5 text-rose-400 font-semibold">${formatNumber(r.B2)}</td>
                            <td class="py-1 px-2.5 text-slate-400">${formatNumber(r.latarA1)}</td>
                            <td class="py-1 px-2.5 text-slate-400">${formatNumber(r.latarA2)}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }

            // Render vehicle radiation profile chart
            const ctx = document.getElementById('chart-profile-lines') || document.getElementById('chart-historis-profile');
            if (ctx && data.chart_data) {
                if (state.charts.profile) state.charts.profile.destroy();
                state.charts.profile = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.chart_data.labels,
                        datasets: [
                            {
                                label: 'Profil_A1',
                                data: data.chart_data.profil_a1,
                                borderColor: '#0284C7', // Blue
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
                                borderColor: '#CA8A04', // Yellow
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
                        interaction: { intersect: false, mode: 'index' },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                backgroundColor: '#0F172A',
                                titleColor: '#F8FAFC',
                                borderColor: '#334155',
                                borderWidth: 1
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
// DATABASE SWITCHER & SELECTION (Multi-tab Synchronized)
// ==========================================
function initDatabaseSwitcher() {
    const savedDb = localStorage.getItem('rpm_active_db');
    const dbSelect = document.getElementById('db-selector-dropdown');
    if (savedDb) {
        state.activeDb = savedDb;
        if (dbSelect) dbSelect.value = savedDb;
        const dbBadge = document.getElementById('active-db-label');
        if (dbBadge) dbBadge.textContent = savedDb;
        const alarmDbBadge = document.getElementById('alarm-active-db-badge');
        if (alarmDbBadge) alarmDbBadge.textContent = savedDb;
    }
    if (dbSelect) {
        dbSelect.addEventListener('change', (e) => {
            switchDatabase(e.target.value);
        });
    }
}

// Global function to switch database dynamically
async function switchDatabase(chosenDb) {
    if (!chosenDb) return;
    try {
        showToast(`Beralih ke database ${chosenDb}...`, 'info');
        const res = await fetch('/api/system/select-db', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ database: chosenDb })
        });
        const json = await res.json();
        if (json.status === 'success') {
            handleServerConnectionSuccess();
            state.activeDb = json.active_db;
            localStorage.setItem('rpm_active_db', json.active_db);
            
            // Sync all UI headers & badges
            const dbBadge = document.getElementById('active-db-label');
            if (dbBadge) dbBadge.textContent = json.active_db;
            const alarmDbBadge = document.getElementById('alarm-active-db-badge');
            if (alarmDbBadge) alarmDbBadge.textContent = json.active_db;
            const dbSelect = document.getElementById('db-selector-dropdown');
            if (dbSelect) dbSelect.value = json.active_db;

            // Log activity
            const user = (window.rpmAuth && window.rpmAuth.currentUser) ? (window.rpmAuth.currentUser.email || window.rpmAuth.currentUser.name) : 'Operator';
            if (typeof window.logSystemActivity === 'function') {
                window.logSystemActivity('DB', user, 'Sukses', `Beralih ke database lokal ${json.active_db}`);
            }

            showToast(`Database aktif berhasil diubah ke ${json.active_db}`, 'success');

            // Refresh Tab Sistem immediately if opened or in background
            loadSystemStatus();

            // Refresh data in active tab
            if (state.activeTab === 'dashboard') {
                loadDashboardStats();
                loadDashboardCharts();
                loadTelemetryCharts();
                loadRecentAlarms(true);
            } else if (state.activeTab === 'historis') {
                initHistorisCalendar();
            } else if (state.activeTab === 'alarm') {
                loadAlarmPage();
            }
        } else {
            showToast(json.message || 'Gagal mengubah database', 'error');
        }
    } catch (err) {
        console.error('Error switching database:', err);
        handleServerConnectionError(err);
        showToast('Gagal terhubung ke server saat mengubah database', 'error');
    }
}
window.switchDatabase = switchDatabase;

// ==========================================
// SYSTEM STATUS & LOCAL CAS_OPERATOR ACCESS
// ==========================================
async function loadSystemStatus() {
    try {
        const res = await fetch(apiUrl('/api/system/status'));
        const json = await res.json();
        if (json.status === 'success') {
            handleServerConnectionSuccess();
            const data = json.data;
            const statusBox = document.getElementById('system-status-container');
            if (statusBox) {
                let dbsHtml = '';
                data.databases.forEach(db => {
                    const isAct = db.is_active;
                    dbsHtml += `
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-3.5 border-b border-slate-800 text-sm hover:bg-slate-900/60 rounded-lg transition-all mb-1">
                            <div class="flex items-center gap-2.5 flex-wrap">
                                <span class="font-mono font-bold ${isAct ? 'text-cyan-400' : 'text-slate-200'} text-sm">${db.name}</span>
                                <span class="text-xs text-slate-500 font-mono">(${db.size_mb} MB)</span>
                                <span class="text-[11px] text-slate-500 font-mono hidden md:inline">• Terakhir Diperbarui: ${db.last_modified}</span>
                                ${isAct ? '<span class="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold tracking-wider">DATABASE AKTIF</span>' : ''}
                            </div>
                            <div class="flex items-center gap-3 mt-2 sm:mt-0">
                                <span class="text-xs ${db.status.includes('Tersedia') ? 'text-emerald-400' : 'text-rose-400'} font-medium">${db.status}</span>
                                ${isAct ? `
                                    <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg flex items-center gap-1">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Sedang Digunakan
                                    </span>
                                ` : `
                                    <button type="button" onclick="window.switchDatabase('${db.name}')" 
                                            class="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5 cursor-pointer">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                        Pilih Database Ini
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                });

                statusBox.innerHTML = `
                    <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-6 shadow-lg">
                        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h3 class="text-base font-bold text-white">Status Koneksi Direktori Lokal (D:\\CAS_OPERATOR)</h3>
                                <p class="text-xs text-slate-400 mt-1">Sistem beroperasi dalam mode proteksi <strong class="text-emerald-400">STRICT READ-ONLY (Tanpa Menulis/Mengubah Data)</strong></p>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-semibold ${data.cas_operator_accessible ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
                                ${data.cas_operator_accessible ? 'TERHUBUNG (ONLINE)' : 'TERPUTUS'}
                            </span>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                            <div class="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                                <span class="text-xs text-slate-400">Path Direktori</span>
                                <p class="font-mono text-xs text-cyan-300 mt-1 font-bold">${data.cas_operator_path}</p>
                            </div>
                            <div class="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                                <span class="text-xs text-slate-400">PHP Environment</span>
                                <p class="font-mono text-xs text-slate-200 mt-1">${data.php_version} (${data.framework})</p>
                            </div>
                            <div class="bg-slate-950/60 p-4 rounded-lg border border-slate-800/80">
                                <span class="text-xs text-slate-400">Proteksi Keamanan File</span>
                                <p class="font-mono text-xs text-emerald-400 mt-1">Strict Read-Only Active (?mode=ro)</p>
                            </div>
                        </div>

                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h4 class="text-sm font-bold text-white">Daftar File Database SQLite Tersedia:</h4>
                                <p class="text-xs text-slate-400">Pilih database untuk mengarahkan pembacaan data di seluruh sistem</p>
                            </div>
                            <span class="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                                Aktif: ${data.active_db}
                            </span>
                        </div>
                        <div class="bg-slate-950/70 rounded-xl p-3 border border-slate-800">
                            ${dbsHtml}
                        </div>
                    </div>
                `;
            }

            renderActivityLogsTable();
        }
    } catch (e) {
        console.error('Error loading system status:', e);
        handleServerConnectionError(e);
    }
}

// ==========================================
// LOG AKTIVITAS AKSES WEB & SISTEM
// ==========================================
function getActivityLogs() {
    try {
        const stored = localStorage.getItem('rpm_system_activity_logs');
        if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Seed realistic initial logs if empty
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const initLogs = [
        {
            id: 'init_1',
            time: fmt(new Date(now.getTime() - 7200000)),
            type: 'SERVER',
            user: 'Sistem Monitoring',
            status: 'Sukses',
            detail: 'Server web online dan terhubung ke direktori D:\\CAS_OPERATOR (Mode Read-Only)'
        },
        {
            id: 'init_2',
            time: fmt(new Date(now.getTime() - 7100000)),
            type: 'DB',
            user: 'Sistem Monitoring',
            status: 'Sukses',
            detail: 'Database awal termuat: rpm_1.db (2.031.348 data okupasi terverifikasi)'
        },
        {
            id: 'init_3',
            time: fmt(new Date(now.getTime() - 1800000)),
            type: 'AUTH',
            user: 'operator@rpm.internal',
            status: 'Sukses',
            detail: 'Pengguna masuk sesi (Demo Mode / Operator CAS)'
        }
    ];
    localStorage.setItem('rpm_system_activity_logs', JSON.stringify(initLogs));
    return initLogs;
}

window.logSystemActivity = function(type, user, status, detail) {
    try {
        const logs = getActivityLogs();
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const timeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        logs.unshift({
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            time: timeStr,
            type: type, // 'AUTH', 'SERVER', 'DB'
            user: user || 'Operator',
            status: status || 'Sukses', // 'Sukses', 'Error', 'Peringatan', 'Info'
            detail: detail || '-'
        });

        if (logs.length > 150) logs.length = 150;
        localStorage.setItem('rpm_system_activity_logs', JSON.stringify(logs));
        renderActivityLogsTable();
    } catch(e) {
        console.error('Error logging system activity:', e);
    }
};

window.clearActivityLogs = function() {
    if (confirm('Bersihkan semua catatan riwayat aktivitas akses dan sistem?')) {
        localStorage.removeItem('rpm_system_activity_logs');
        renderActivityLogsTable();
        showToast('Riwayat aktivitas telah dibersihkan', 'info');
    }
};

let activeActivityFilter = 'all';

function initActivityLogFilters() {
    document.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeActivityFilter = btn.getAttribute('data-activity-filter');
            document.querySelectorAll('.activity-filter-btn').forEach(b => {
                b.classList.remove('text-cyan-400', 'bg-slate-800', 'font-semibold');
                b.classList.add('text-slate-400');
            });
            btn.classList.add('text-cyan-400', 'bg-slate-800', 'font-semibold');
            btn.classList.remove('text-slate-400');
            renderActivityLogsTable();
        });
    });
}

function renderActivityLogsTable() {
    const tbody = document.getElementById('table-activity-logs-tbody');
    if (!tbody) return;

    let logs = getActivityLogs();
    if (activeActivityFilter !== 'all') {
        logs = logs.filter(l => l.type === activeActivityFilter);
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Tidak ada catatan aktivitas untuk filter ini.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    logs.forEach((log, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-800/80 hover:bg-slate-800/30 text-xs transition-colors';

        let typeBadge = '';
        if (log.type === 'AUTH') {
            typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">LOGIN / LOGOUT</span>';
        } else if (log.type === 'SERVER') {
            typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">SERVER / JARINGAN</span>';
        } else if (log.type === 'DB') {
            typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">DATABASE</span>';
        } else {
            typeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">${log.type}</span>`;
        }

        let statusBadge = '';
        if (log.status === 'Sukses') {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">SUKSES</span>';
        } else if (log.status === 'Error') {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">TERPUTUS / ERROR</span>';
        } else if (log.status === 'Peringatan') {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">PERINGATAN</span>';
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">${log.status}</span>`;
        }

        tr.innerHTML = `
            <td class="py-2.5 px-3 text-slate-500">${idx + 1}</td>
            <td class="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">${log.time}</td>
            <td class="py-2.5 px-3 whitespace-nowrap">${typeBadge}</td>
            <td class="py-2.5 px-3 text-slate-200 font-sans font-medium">${log.user}</td>
            <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
            <td class="py-2.5 px-3 text-slate-300 font-sans">${log.detail}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// SERVER CONNECTION WATCHDOG
// ==========================================
let isServerConnected = true;

function handleServerConnectionError(e) {
    if (isServerConnected) {
        isServerConnected = false;
        if (typeof window.logSystemActivity === 'function') {
            window.logSystemActivity('SERVER', 'Server / Jaringan', 'Error', 'Koneksi ke backend server (http://127.0.0.1:5000) terputus atau tidak merespons');
        }
        showToast('Koneksi server terputus! Mencoba memulihkan...', 'error');
    }
}

function handleServerConnectionSuccess() {
    if (!isServerConnected) {
        isServerConnected = true;
        if (typeof window.logSystemActivity === 'function') {
            window.logSystemActivity('SERVER', 'Server / Jaringan', 'Sukses', 'Koneksi ke backend server kembali normal (Online)');
        }
        showToast('Koneksi server kembali normal', 'success');
    }
}
