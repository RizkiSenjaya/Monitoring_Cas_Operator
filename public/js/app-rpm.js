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
    charts: {}
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
    loadRecentAlarms();

    const refreshBtn = document.getElementById('btn-refresh-dashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showToast('Memperbarui data dashboard...', 'info');
            loadDashboardStats();
            loadDashboardCharts();
            loadRecentAlarms();
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
        }
    } catch (e) {
        console.error('Error fetching dashboard stats:', e);
    }
}

async function loadDashboardCharts() {
    try {
        const res = await fetch('/api/dashboard/charts');
        const json = await res.json();
        if (json.status === 'success') {
            renderDashboardCharts(json.data);
        }
    } catch (e) {
        console.error('Error fetching dashboard charts:', e);
    }
}

function renderDashboardCharts(data) {
    // 1. Chart Historis Okupasi
    const okupasiCtx = document.getElementById('chart-okupasi');
    if (okupasiCtx) {
        if (state.charts.okupasi) state.charts.okupasi.destroy();
        state.charts.okupasi = new Chart(okupasiCtx, {
            type: 'line',
            data: {
                labels: data.okupasi.labels,
                datasets: [{
                    label: 'Okupasi',
                    data: data.okupasi.series,
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.18)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: getDarkChartOptions('Jumlah sampel per hari', 'Sampel')
        });
    }

    // 2. Chart Historis Alarm
    const alarmCtx = document.getElementById('chart-alarm');
    if (alarmCtx) {
        if (state.charts.alarm) state.charts.alarm.destroy();
        state.charts.alarm = new Chart(alarmCtx, {
            type: 'line',
            data: {
                labels: data.alarm.labels,
                datasets: [{
                    label: 'Alarm',
                    data: data.alarm.series,
                    borderColor: '#38BDF8',
                    backgroundColor: 'rgba(56, 189, 248, 0.18)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: getDarkChartOptions('Event per hari', 'Event')
        });
    }

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

async function loadRecentAlarms() {
    try {
        const res = await fetch('/api/dashboard/alarms');
        const json = await res.json();
        const tbody = document.getElementById('table-alarm-tbody');
        if (!tbody || json.status !== 'success') return;

        tbody.innerHTML = '';
        json.data.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/40 text-xs text-slate-300 transition-colors';
            tr.innerHTML = `
                <td class="py-2.5 px-3 font-mono text-slate-400">${item.waktu}</td>
                <td class="py-2.5 px-3 font-semibold text-cyan-400">${item.pilar}</td>
                <td class="py-2.5 px-3">${item.jenis}</td>
                <td class="py-2.5 px-3"><span class="${item.a1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.a1}</span></td>
                <td class="py-2.5 px-3"><span class="${item.a2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.a2}</span></td>
                <td class="py-2.5 px-3"><span class="${item.b1 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.b1}</span></td>
                <td class="py-2.5 px-3"><span class="${item.b2 === 'ON' ? 'text-rose-400 font-bold' : 'text-slate-400'}">${item.b2}</span></td>
                <td class="py-2.5 px-3 font-mono text-slate-400">${item.latar}</td>
                <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${item.ack === 'Sudah' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                        ${item.ack}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
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
