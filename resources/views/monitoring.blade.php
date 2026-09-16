<!DOCTYPE html>
<html lang="id" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>RPM Web Monitoring - Radiation Portal Monitor</title>
    
    <!-- Tailwind CSS CDN with custom config -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        rpm: {
                            bg: '#070D18',
                            sidebar: '#0B1326',
                            card: '#0F1A30',
                            cardLight: '#142240',
                            border: '#1A294A',
                            cyan: '#00E5FF',
                            neonBlue: '#38BDF8',
                            warning: '#F59E0B',
                            danger: '#EF4444',
                            success: '#10B981',
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
                    }
                }
            }
        }
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

    <!-- Firebase App & Auth SDK (Compat) -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>

    <style>
        body {
            background-color: #070D18;
            color: #E2E8F0;
            font-family: 'Inter', sans-serif;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        ::-webkit-scrollbar-track {
            background: #0B1326;
        }
        ::-webkit-scrollbar-thumb {
            background: #1E293B;
            border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #00E5FF;
        }
        @keyframes pulse-glow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.15); }
        }
        .pulse-live {
            animation: pulse-glow 2s infinite ease-in-out;
        }
    </style>
</head>
<body class="min-h-screen flex overflow-hidden">

    <!-- ========================================== -->
    <!-- 1. FIREBASE AUTH MODAL (PROTECTED ACCESS)  -->
    <!-- ========================================== -->
    <div id="auth-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300">
        <div class="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div class="absolute -top-16 -right-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl"></div>
            <div class="absolute -bottom-16 -left-16 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl"></div>

            <div class="flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/30">
                    RPM
                </div>
                <div>
                    <h2 class="text-lg font-bold text-white tracking-wide">Radiation Portal Monitor</h2>
                    <p class="text-xs text-slate-400">Sistem Pemantauan Radiasi Terintegrasi</p>
                </div>
            </div>

            <!-- Error Message Banner -->
            <div id="auth-error-box" class="hidden mb-4 p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 leading-relaxed">
            </div>

            <!-- Tabs: Login / Sign Up -->
            <div class="flex border-b border-slate-800 mb-6">
                <button id="tab-btn-login" class="flex-1 pb-2.5 text-sm font-semibold text-cyan-400 border-b-2 border-cyan-400 transition-all">
                    Masuk (Login)
                </button>
                <button id="tab-btn-signup" class="flex-1 pb-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all">
                    Daftar (Sign Up)
                </button>
            </div>

            <!-- Login Form -->
            <form id="form-login" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Email Akun</label>
                    <input type="email" id="login-email" placeholder="nama@email.com" required
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi</label>
                    <input type="password" id="login-password" placeholder="Masukkan kata sandi akun" required
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <div class="flex items-center justify-between text-xs">
                    <label class="flex items-center text-slate-400 cursor-pointer">
                        <input type="checkbox" checked class="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 mr-2">
                        Ingat sesi saya
                    </label>
                    <span class="text-slate-500 text-[11px]">Gunakan akun terdaftar</span>
                </div>
                <button type="submit" id="btn-submit-login" class="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm rounded-lg shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2">
                    <span>Masuk ke Sistem</span>
                </button>
            </form>

            <!-- Sign Up Form -->
            <form id="form-signup" class="space-y-4 hidden">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Nama Lengkap</label>
                    <input type="text" id="signup-name" placeholder="Nama Operator / Petugas" required
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Alamat Email</label>
                    <input type="email" id="signup-email" placeholder="nama@email.com" required
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi</label>
                    <input type="password" id="signup-password" placeholder="Minimal 6 karakter" required minlength="6"
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1.5">Konfirmasi Kata Sandi</label>
                    <input type="password" id="signup-password-confirm" placeholder="Ulangi kata sandi di atas" required minlength="6"
                           class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400">
                </div>
                <button type="submit" id="btn-submit-signup" class="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                    <span>Daftar Akun Baru</span>
                </button>
            </form>

            <div class="relative my-5 text-center">
                <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-800"></div></div>
                <span class="relative bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider">Atau Masuk Melalui</span>
            </div>

            <div class="space-y-2.5">
                <button type="button" id="btn-google-auth" class="w-full flex items-center justify-center gap-3 py-2 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-all shadow">
                    <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span id="btn-google-text">Sign In with Google</span>
                </button>

                <button type="button" id="btn-demo-auth" class="w-full py-1.5 px-4 bg-transparent hover:bg-slate-800 text-slate-500 hover:text-slate-300 text-xs rounded transition-all flex items-center justify-center gap-1.5">
                    Mode Demo Tamu (Akses Cepat Pengujian)
                </button>
            </div>
        </div>
    </div>


    <!-- ========================================== -->
    <!-- 2. SIDEBAR NAVIGATION                      -->
    <!-- ========================================== -->
    <aside class="w-64 bg-[#0B1326] border-r border-[#1A294A] flex flex-col justify-between flex-shrink-0 z-20">
        <div>
            <!-- Branding Header -->
            <div class="h-16 flex items-center gap-3 px-5 border-b border-[#1A294A]">
                <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-500/20 text-xs">
                    RPM
                </div>
                <div>
                    <h1 class="text-sm font-bold text-white leading-tight tracking-wide">RPM Monitor</h1>
                    <p class="text-[10px] text-slate-400 tracking-wider uppercase">Radiation Portal Monitor</p>
                </div>
            </div>

            <!-- Navigation Links -->
            <nav class="p-3 space-y-1 mt-2">
                <button data-tab-target="dashboard" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-400 border-l-4 border-cyan-400 transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                    Dashboard
                </button>

                <button data-tab-target="historis" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Historis Okupasi
                </button>

                <button data-tab-target="alarm" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    Historis Alarm
                </button>

                <button data-tab-target="pilar" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                    Status Pilar
                </button>

                <button data-tab-target="sistem" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Sistem
                </button>
            </nav>
        </div>

        <!-- Sidebar Footer Status -->
        <div class="p-4 border-t border-[#1A294A] bg-[#070D18]/60">
            <div class="flex items-center gap-2 mb-1">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span class="text-[11px] font-mono text-slate-300 font-semibold">Web GUI - SQLite</span>
            </div>
            <div class="text-[10px] text-slate-500 font-mono">
                Database: <span id="active-db-label" class="text-cyan-400 font-bold">rpm_1.db</span>
            </div>
        </div>
    </aside>


    <!-- ========================================== -->
    <!-- 3. MAIN CONTENT AREA                       -->
    <!-- ========================================== -->
    <div class="flex-1 flex flex-col h-screen overflow-hidden bg-[#070D18]">
        
        <!-- Top App Header -->
        <header class="h-16 border-b border-[#1A294A] px-6 flex items-center justify-between bg-[#0B1326]/80 backdrop-blur-sm z-10">
            <div>
                <span class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">MONITORING REAL TIME</span>
                <div class="flex items-center gap-2">
                    <h2 class="text-base font-bold text-white tracking-wide">Radiation Portal Monitor</h2>
                    <span class="text-xs text-slate-400 font-normal hidden md:inline">Dashboard data RPM dari database lokal</span>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <!-- Database Switcher Dropdown -->
                <div class="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                    <span class="text-[11px] text-slate-400 font-medium">DB:</span>
                    <select id="db-selector-dropdown" onchange="switchDatabase(this.value)" class="bg-transparent text-xs text-cyan-300 font-mono font-bold focus:outline-none cursor-pointer">
                        <option value="rpm_1.db" class="bg-slate-900 text-slate-200">rpm_1.db (2.03M Okupasi)</option>
                        <option value="rpm.db" class="bg-slate-900 text-slate-200">rpm.db (1.48M Okupasi)</option>
                        <option value="rpm_22.db" class="bg-slate-900 text-slate-200">rpm_22.db (Arsip)</option>
                        <option value="log.db" class="bg-slate-900 text-slate-200">log.db (System Logs)</option>
                    </select>
                </div>

                <!-- Live Clock -->
                <div class="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 pulse-live"></span>
                    <span id="live-clock" class="font-mono text-xs font-bold text-emerald-400">• LIVE --:--:--</span>
                </div>

                <!-- Refresh Button -->
                <button id="btn-refresh-dashboard" title="Segarkan Data"
                        class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold px-2.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh
                </button>

                <!-- User Profile & Logout -->
                <div id="user-profile-menu" class="flex items-center gap-2 pl-3 border-l border-slate-800">
                    <div id="user-avatar-display" class="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shadow-inner overflow-hidden flex-shrink-0">
                        OP
                    </div>
                    <div class="hidden lg:block text-left">
                        <div id="user-name-display" class="text-xs font-semibold text-slate-200 leading-none">Senior Operator</div>
                        <div id="user-email-display" class="text-[10px] text-slate-400 leading-none mt-0.5">operator@rpm.internal</div>
                    </div>
                    <button id="btn-logout" title="Keluar / Logout" class="ml-1 text-slate-400 hover:text-rose-400 p-1 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Scrollable Body -->
        <main class="flex-1 overflow-y-auto p-6 space-y-6">

            <!-- ==================================================== -->
            <!-- TAB 1: DASHBOARD VIEW (Persis Seperti Gambar 2 & 3)  -->
            <!-- ==================================================== -->
            <div data-tab-view="dashboard" class="space-y-6">
                
                <!-- 4 Stat Cards Row (Image 3) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <!-- Card 1: Total Okupasi -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg hover:border-cyan-500/40 transition-all">
                        <span class="text-xs font-medium text-slate-400">Total Okupasi</span>
                        <div id="stat-total-okupasi" class="text-2xl font-extrabold text-white mt-1 tracking-tight">2.031.348</div>
                        <span class="text-[11px] text-slate-500 mt-0.5 block">record terdeteksi</span>
                    </div>

                    <!-- Card 2: Total Alarm -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg hover:border-cyan-500/40 transition-all">
                        <span class="text-xs font-medium text-slate-400">Total Alarm</span>
                        <div id="stat-total-alarm" class="text-2xl font-extrabold text-white mt-1 tracking-tight">4.230</div>
                        <span class="text-[11px] text-slate-500 mt-0.5 block">event tersimpan</span>
                    </div>

                    <!-- Card 3: Data Log -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg hover:border-cyan-500/40 transition-all">
                        <span class="text-xs font-medium text-slate-400">Data Log</span>
                        <div id="stat-data-log" class="text-2xl font-extrabold text-white mt-1 tracking-tight">88</div>
                        <span class="text-[11px] text-slate-500 mt-0.5 block">rekaman alarm</span>
                    </div>

                    <!-- Card 4: Data Latar -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg hover:border-cyan-500/40 transition-all">
                        <span class="text-xs font-medium text-slate-400">Data Latar</span>
                        <div id="stat-data-latar" class="text-2xl font-extrabold text-white mt-1 tracking-tight">794</div>
                        <span class="text-[11px] text-slate-500 mt-0.5 block">rekaman background</span>
                    </div>
                </div>

                <!-- Status Terakhir & Ringkasan Sistem (Image 3 Row 2 & Gambar 4) -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <!-- Status Terakhir (2 Cols - 2 Detector Cards Gambar 4) -->
                    <div class="lg:col-span-2 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg relative flex flex-col justify-between">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <h3 class="text-sm font-bold text-white">Status Terakhir Portal</h3>
                                <p id="status-terakhir-waktu" class="text-xs font-mono text-slate-400">2025-11-14 9:56:26</p>
                            </div>
                            <span id="badge-status-terakhir" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm shadow-rose-500/40">
                                ALARM
                            </span>
                        </div>

                        <!-- 2 Detector Cards (Gambar 4) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-2">
                            <!-- Detector A (Pilar 115) Card -->
                            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 hover:border-cyan-500/40 transition-all shadow-inner">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                                        <span class="text-xs font-bold text-cyan-400 uppercase tracking-wider">DETECTOR A (Pilar 115)</span>
                                    </div>
                                    <span id="det-a-badge" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        NORMAL
                                    </span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 mt-2">
                                    <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-slate-400 block font-medium">Channel A1 (Atas)</span>
                                        <span id="det-a1-cps" class="text-sm font-bold text-white font-mono">1.160 cps</span>
                                    </div>
                                    <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-slate-400 block font-medium">Channel A2 (Bawah)</span>
                                        <span id="det-a2-cps" class="text-sm font-bold text-white font-mono">940 cps</span>
                                    </div>
                                </div>
                                <div class="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5 font-mono">
                                    <span>Total / Latar:</span>
                                    <span id="det-a-val" class="font-bold text-slate-200">1.160 / 940</span>
                                </div>
                            </div>

                            <!-- Detector B (Pilar 116) Card -->
                            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 hover:border-cyan-500/40 transition-all shadow-inner">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                                        <span class="text-xs font-bold text-blue-400 uppercase tracking-wider">DETECTOR B (Pilar 116)</span>
                                    </div>
                                    <span id="det-b-badge" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        NORMAL
                                    </span>
                                </div>
                                <div class="grid grid-cols-2 gap-2 mt-2">
                                    <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-slate-400 block font-medium">Channel B1 (Atas)</span>
                                        <span id="det-b1-cps" class="text-sm font-bold text-white font-mono">1.050 cps</span>
                                    </div>
                                    <div class="bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                                        <span class="text-[10px] text-slate-400 block font-medium">Channel B2 (Bawah)</span>
                                        <span id="det-b2-cps" class="text-sm font-bold text-white font-mono">850 cps</span>
                                    </div>
                                </div>
                                <div class="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-1.5 font-mono">
                                    <span>Total / Latar:</span>
                                    <span id="det-b-val" class="font-bold text-slate-200">1.050 / 850</span>
                                </div>
                            </div>
                        </div>

                        <!-- Environmental Strip -->
                        <div class="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs">
                            <div class="flex items-center justify-between px-2.5 py-1 bg-slate-900/40 rounded-lg">
                                <span class="text-slate-400 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                                    Suhu Sensor:
                                </span>
                                <span id="suhu-val" class="font-bold font-mono text-white">37 °C</span>
                            </div>
                            <div class="flex items-center justify-between px-2.5 py-1 bg-slate-900/40 rounded-lg">
                                <span class="text-slate-400 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                                    Kelembaban (RH):
                                </span>
                                <span id="humidity-val" class="font-bold font-mono text-white">47 %</span>
                            </div>
                        </div>
                    </div>

                    <!-- Ringkasan Sistem (1 Col) -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                        <h3 class="text-sm font-bold text-white">Ringkasan Sistem</h3>
                        <p class="text-xs text-slate-400 mb-4">Record terakhir</p>

                        <div class="space-y-2.5 text-xs">
                            <div class="flex items-center justify-between py-1 border-b border-slate-800">
                                <span class="text-slate-400 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Detector A
                                </span>
                                <span id="ringkasan-det-a" class="font-bold text-emerald-400">NORMAL</span>
                            </div>
                            <div class="flex items-center justify-between py-1 border-b border-slate-800">
                                <span class="text-slate-400 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Detector B
                                </span>
                                <span id="ringkasan-det-b" class="font-bold text-emerald-400">NORMAL</span>
                            </div>
                            <div class="flex items-center justify-between py-1 border-b border-slate-800">
                                <span class="text-slate-400 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Okupasi
                                </span>
                                <span id="ringkasan-okupasi" class="font-bold text-emerald-400">YA</span>
                            </div>
                            <div class="flex items-center justify-between py-1">
                                <span class="text-slate-400 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-rose-500"></span> Alarm
                                </span>
                                <span id="ringkasan-alarm" class="font-bold text-rose-500">AKTIF</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- [SWAPPED UP] Realtime Laju Cacah (cps) & Suhu/Kelembaban 1 Jam Terakhir -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                        <div class="mb-3 flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-bold text-white">Grafik Laju Cacah (cps) Real-Time</h3>
                                <p class="text-xs text-slate-400">Perbandingan Pilar 115 vs Pilar 116 (1 jam terakhir)</p>
                            </div>
                            <span class="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">Area Chart</span>
                        </div>
                        <div class="h-56">
                            <canvas id="chart-cps-realtime"></canvas>
                        </div>
                    </div>

                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                        <div class="mb-3 flex justify-between items-center">
                            <div>
                                <h3 class="text-sm font-bold text-white">Grafik Suhu (°C) & Kelembaban (%)</h3>
                                <p class="text-xs text-slate-400">Telemetri Lingkungan Pilar 115 & Pilar 116</p>
                            </div>
                            <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">Sensors</span>
                        </div>
                        <div class="h-56">
                            <canvas id="chart-env-realtime"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Integrated Time Range & Filter Bar for Historis Okupasi & Alarm -->
                <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
                            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                            </svg>
                            Filter Historis:
                        </span>

                        <!-- Mode Segmented Buttons -->
                        <div class="inline-flex rounded-lg bg-slate-900/90 p-1 border border-slate-700/60" id="historis-mode-buttons">
                            <button type="button" data-mode="1hour" class="filter-mode-btn px-3 py-1 rounded-md text-xs font-bold transition-all bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm">
                                <span class="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-1 pulse-live"></span>
                                LIVE 1 Jam
                            </button>
                            <button type="button" data-mode="hour" class="filter-mode-btn px-3 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200">
                                Per Jam
                            </button>
                            <button type="button" data-mode="day" class="filter-mode-btn px-3 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200">
                                Per Hari
                            </button>
                            <button type="button" data-mode="month" class="filter-mode-btn px-3 py-1 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200">
                                Per Bulan
                            </button>
                        </div>
                    </div>

                    <!-- Dynamic Filter Controls -->
                    <div class="flex items-center gap-2 flex-wrap" id="historis-filter-controls">
                        <!-- Date Input (for Hour & Day modes) -->
                        <div id="filter-date-group" class="hidden items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                            <span class="text-[11px] text-slate-400">Tanggal:</span>
                            <input type="date" id="filter-date-input" value="2025-11-14" 
                                   class="bg-transparent text-xs text-cyan-300 font-mono focus:outline-none cursor-pointer">
                        </div>

                        <!-- Hour Dropdown (for Hour mode) -->
                        <div id="filter-hour-group" class="hidden items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                            <span class="text-[11px] text-slate-400">Jam:</span>
                            <select id="filter-hour-select" class="bg-transparent text-xs text-cyan-300 font-mono focus:outline-none cursor-pointer">
                                <!-- Populated dynamically 00:00 - 23:00 -->
                            </select>
                        </div>

                        <!-- Month Dropdown (for Month mode) -->
                        <div id="filter-month-group" class="hidden items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg">
                            <span class="text-[11px] text-slate-400">Bulan:</span>
                            <select id="filter-month-select" class="bg-transparent text-xs text-cyan-300 font-mono focus:outline-none cursor-pointer">
                                <option value="2025-11" selected class="bg-slate-900 text-slate-200">November 2025</option>
                                <option value="2025-10" class="bg-slate-900 text-slate-200">Oktober 2025</option>
                            </select>
                        </div>

                        <!-- Apply Button -->
                        <button type="button" id="btn-apply-historis-filter" 
                                class="hidden px-3.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-cyan-600/30 transition-all flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Terapkan
                        </button>

                        <!-- Live Streaming Indicator (when mode is 1hour) -->
                        <div id="filter-live-indicator" class="flex items-center gap-2 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[11px] text-cyan-300 font-mono">
                            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-live"></span>
                            <span>STREAMING REAL-TIME 1 JAM (1s INTERVAL)</span>
                        </div>
                    </div>
                </div>

                <!-- [SWAPPED DOWN] 2 Graphs (Historis Okupasi & Historis Alarm - Image 3) -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <!-- Chart Historis Okupasi -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                        <div class="mb-3 flex justify-between items-center">
                            <div>
                                <h3 id="okupasi-chart-title" class="text-sm font-bold text-white">Historis Okupasi</h3>
                                <p id="okupasi-chart-subtitle" class="text-xs text-slate-400">Real-time sliding window 1 jam terakhir tiap detik</p>
                            </div>
                            <span id="okupasi-alarm-badge" class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-all">
                                NORMAL REAL-TIME
                            </span>
                        </div>
                        <div class="h-60">
                            <canvas id="chart-okupasi"></canvas>
                        </div>
                    </div>

                    <!-- Chart Historis Alarm -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                        <div class="mb-3 flex justify-between items-center">
                            <div>
                                <h3 id="alarm-chart-title" class="text-sm font-bold text-white">Historis Alarm</h3>
                                <p id="alarm-chart-subtitle" class="text-xs text-slate-400">Event alarm 1 jam terakhir per menit</p>
                            </div>
                            <span id="alarm-rate-badge" class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 transition-all">
                                LIVE 1 JAM
                            </span>
                        </div>
                        <div class="h-60">
                            <canvas id="chart-alarm"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Monitoring Pilar Table (Image 2 & 3) -->
                <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                    <div class="mb-4">
                        <h3 class="text-sm font-bold text-white">Monitoring Pilar</h3>
                        <p class="text-xs text-slate-400">Agregasi dan total Alarm</p>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                                <tr>
                                    <th class="py-2.5 px-4">PILAR</th>
                                    <th class="py-2.5 px-4">SAMPEL</th>
                                    <th class="py-2.5 px-4">OKUPASI</th>
                                    <th class="py-2.5 px-4">RATA-RATA SUHU</th>
                                    <th class="py-2.5 px-4">RATA-RATA RH</th>
                                    <th class="py-2.5 px-4">PEAK ALARM</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-800 text-slate-200">
                                <tr class="hover:bg-slate-800/30">
                                    <td class="py-3 px-4 font-bold text-cyan-400">Pilar 115</td>
                                    <td class="py-3 px-4">2.030</td>
                                    <td class="py-3 px-4">2.030</td>
                                    <td class="py-3 px-4">35.2 °C</td>
                                    <td class="py-3 px-4">44.2 %</td>
                                    <td class="py-3 px-4 font-bold text-rose-400">4</td>
                                </tr>
                                <tr class="hover:bg-slate-800/30">
                                    <td class="py-3 px-4 font-bold text-cyan-400">Pilar 116</td>
                                    <td class="py-3 px-4">2.230</td>
                                    <td class="py-3 px-4">2.230</td>
                                    <td class="py-3 px-4">37.3 °C</td>
                                    <td class="py-3 px-4">45.0 %</td>
                                    <td class="py-3 px-4 font-bold text-rose-400">4</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>


            <!-- ==================================================== -->
            <!-- TAB 2: HISTORIS VIEW (Persis Seperti Gambar 1)       -->
            <!-- ==================================================== -->
            <div data-tab-view="historis" class="space-y-4 hidden">
                
                <!-- Desktop Application Title Bar Replica -->
                <div class="flex items-center justify-between bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 rounded-lg shadow-md">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-cyan-400"></div>
                        <h2 class="text-base font-bold text-white tracking-wide">Data Okupasi RPM</h2>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-400 font-mono">D:\CAS_OPERATOR (Read-Only)</span>
                    </div>
                </div>

                <!-- Layout 3 Columns (Left: Calendar & Vehicle List, Center: Chart, Right: Snapshot) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    
                    <!-- Left Section: Calendar + Buttons + Vehicle List (Col 4) -->
                    <div class="xl:col-span-4 space-y-4">
                        
                        <!-- Top Box: Calendar & Buttons -->
                        <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg">
                            <!-- Calendar Component (Full Width) -->
                            <div class="w-full bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-xs font-bold text-cyan-400">November 2025</span>
                                    <input type="date" id="historis-date-picker" value="2025-11-15" class="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-0.5 font-mono">
                                </div>
                                <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1 font-semibold">
                                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                                </div>
                                <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-mono">
                                    <span class="text-slate-600">26</span><span class="text-slate-600">27</span><span class="text-slate-600">28</span><span class="text-slate-600">29</span><span class="text-slate-600">30</span><span class="text-slate-600">31</span>
                                    <span data-cal-day="1" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">1</span>
                                    <span data-cal-day="2" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">2</span>
                                    <span data-cal-day="3" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">3</span>
                                    <span data-cal-day="4" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">4</span>
                                    <span data-cal-day="5" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">5</span>
                                    <span data-cal-day="6" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">6</span>
                                    <span data-cal-day="7" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">7</span>
                                    <span data-cal-day="8" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">8</span>
                                    <span data-cal-day="9" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">9</span>
                                    <span data-cal-day="10" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">10</span>
                                    <span data-cal-day="11" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">11</span>
                                    <span data-cal-day="12" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">12</span>
                                    <span data-cal-day="13" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">13</span>
                                    <span data-cal-day="14" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">14</span>
                                    <span data-cal-day="15" class="py-0.5 rounded bg-cyan-600 text-white font-bold cursor-pointer">15</span>
                                    <span data-cal-day="16" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">16</span>
                                    <span data-cal-day="17" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">17</span>
                                    <span data-cal-day="18" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">18</span>
                                    <span data-cal-day="19" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">19</span>
                                    <span data-cal-day="20" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">20</span>
                                    <span data-cal-day="21" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">21</span>
                                    <span data-cal-day="22" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">22</span>
                                    <span data-cal-day="23" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">23</span>
                                    <span data-cal-day="24" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">24</span>
                                    <span data-cal-day="25" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">25</span>
                                    <span data-cal-day="26" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">26</span>
                                    <span data-cal-day="27" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">27</span>
                                    <span data-cal-day="28" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">28</span>
                                    <span data-cal-day="29" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">29</span>
                                    <span data-cal-day="30" class="py-0.5 rounded hover:bg-slate-800 cursor-pointer">30</span>
                                </div>
                                <div class="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between">
                                    <span>Today: 16/09/2026</span>
                                    <span class="text-cyan-400 font-semibold cursor-pointer hover:underline" onclick="document.querySelector('[data-cal-day=\'15\']').click()">Pilih 15 Nov</span>
                                </div>
                            </div>

                            <!-- Action Buttons Under Date/Calendar (3 Buttons Row) -->
                            <div class="grid grid-cols-3 gap-2.5 mt-3">
                                <button type="button" id="btn-okupasi-data" class="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-xs font-semibold text-slate-200 hover:text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                    <span class="truncate">Okupasi Data</span>
                                </button>
                                <button type="button" id="btn-export-okupasi-csv" onclick="exportOkupasiDataCSV()" class="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-xs font-semibold text-slate-200 hover:text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                    <svg class="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                    <span class="truncate">Export to CSV</span>
                                </button>
                                <button type="button" onclick="switchTab('dashboard')" class="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                    <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>
                                    <span>Exit</span>
                                </button>
                            </div>
                        </div>

                        <!-- Vehicle List Table (Image 1) -->
                        <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="text-xs font-bold text-white uppercase tracking-wider">Vehicle List</h3>
                                <button id="btn-tampil-profile" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded shadow">
                                    Tampil Profile
                                </button>
                            </div>

                            <div class="overflow-x-auto max-h-72 border border-slate-800 rounded">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold sticky top-0">
                                        <tr>
                                            <th class="py-1.5 px-2 text-center w-10">No</th>
                                            <th class="py-1.5 px-2 text-center w-14">Detail</th>
                                            <th class="py-1.5 px-2">IDK</th>
                                            <th class="py-1.5 px-2">TGL</th>
                                        </tr>
                                    </thead>
                                    <tbody id="vehicle-list-tbody" class="divide-y divide-slate-800/80">
                                        <tr><td colspan="4" class="py-4 text-center text-slate-500">Memuat kendaraan...</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    <!-- Right & Middle Section: Chart + Camera Snapshot (Col 8) -->
                    <div class="xl:col-span-8 space-y-4">
                        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <!-- Multi-line Profile Chart (7 Cols) -->
                            <div class="lg:col-span-7 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="text-xs font-bold text-white">Profil Radiasi Kendaraan</h3>
                                    <div class="flex items-center gap-2 text-[10px]">
                                        <span class="text-blue-400 font-semibold">Profil_A1</span>
                                        <span class="text-emerald-400 font-semibold">Profil_A2</span>
                                        <span class="text-yellow-400 font-semibold">Profil_B1</span>
                                        <span class="text-rose-400 font-semibold">Profil_B2</span>
                                    </div>
                                </div>
                                <div class="h-64">
                                    <canvas id="chart-profile-lines"></canvas>
                                </div>
                            </div>

                            <!-- Vehicle Snapshot Camera 01 (5 Cols - Image 1) -->
                            <div class="lg:col-span-5 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                                <div class="flex items-center justify-between mb-2">
                                    <h3 class="text-xs font-bold text-white">Camera Snapshot</h3>
                                    <span class="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[10px] font-bold">PORTAL CAM</span>
                                </div>

                                <div class="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex-1 min-h-[190px] flex items-center justify-center">
                                    <!-- Snapshot Image directly from D:\CAS_OPERATOR\snapshots\... -->
                                    <img id="vehicle-snapshot-img"
                                         src="/api/historis/snapshot/251115095949"
                                         alt="Camera 01 Snapshot"
                                         class="w-full h-full object-cover rounded">
                                    
                                    <!-- Camera 01 overlay label (Matching Image 1) -->
                                    <div class="absolute top-2 left-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 font-bold" id="camera-timestamp-overlay">
                                        11-15-2025 09:59:49 Camera 01
                                    </div>
                                    <div class="absolute bottom-2 right-2 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                                        RPM Portal Entrance
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Detailed Profile Data Grid Table (Image 1 Bottom Table) -->
                        <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-xs font-bold text-white uppercase tracking-wider">Detail Data Profile Sensor</h3>
                                <span class="text-[11px] text-slate-400 font-mono">Tabel Tanggal & Profile (IDK)</span>
                            </div>

                            <div class="overflow-x-auto max-h-56 border border-slate-800 rounded">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold sticky top-0">
                                        <tr>
                                            <th class="py-1.5 px-2.5">IDK</th>
                                            <th class="py-1.5 px-2.5">TGL</th>
                                            <th class="py-1.5 px-2.5 text-blue-400">A1</th>
                                            <th class="py-1.5 px-2.5 text-emerald-400">A2</th>
                                            <th class="py-1.5 px-2.5 text-yellow-400">B1</th>
                                            <th class="py-1.5 px-2.5 text-rose-400">B2</th>
                                            <th class="py-1.5 px-2.5">Latar A1</th>
                                            <th class="py-1.5 px-2.5">Latar A2</th>
                                        </tr>
                                    </thead>
                                    <tbody id="profile-grid-tbody" class="divide-y divide-slate-800/80">
                                        <tr><td colspan="8" class="py-4 text-center text-slate-500">Pilih kendaraan untuk menampilkan grid profile.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                </div>

            </div>


            <!-- ==================================================== -->
            <!-- TAB 3: ALARM VIEW (Replika Alarm RPM Sesuai Gambar 2) -->
            <!-- ==================================================== -->
            <div data-tab-view="alarm" class="space-y-4 hidden">
                
                <!-- Desktop Title Bar Replica (Matching Gambar 2 "Alarm RPM") -->
                <div class="flex items-center justify-between bg-slate-900/90 border border-slate-700/80 px-4 py-2.5 rounded-lg shadow-md">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></div>
                        <h2 class="text-base font-bold text-white tracking-wide">Alarm RPM</h2>
                        <span class="text-xs text-rose-400 font-medium px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">Monitoring & Verifikasi Alarm Radiasi</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-slate-400 font-mono">Database Aktif: <strong id="alarm-active-db-badge" class="text-cyan-400">rpm_1.db</strong></span>
                        <span class="text-xs text-slate-500 font-mono">D:\CAS_OPERATOR (Read-Only)</span>
                    </div>
                </div>

                <!-- 3 Columns Top Section (Matching Gambar 2) -->
                <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    
                    <!-- Left Section: Calendar + Action Buttons (Matching Historis Okupasi & Gambar 2/3) -->
                    <div class="xl:col-span-4 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                        <!-- Calendar Component (Replika Historis Okupasi - Full Width) -->
                        <div class="w-full bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                            <div class="flex items-center justify-between mb-2">
                                <span id="alarm-cal-month-year" class="text-xs font-bold text-rose-400">November 2025</span>
                                <input type="date" id="alarm-date-picker" value="2025-11-14" class="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-0.5 font-mono">
                            </div>
                            <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1 font-semibold">
                                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                            </div>
                            <div id="alarm-cal-grid" class="grid grid-cols-7 gap-1 text-center text-[11px] font-mono">
                                <!-- Dynamic days rendered by JS -->
                            </div>
                            <div class="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between items-center">
                                <span>Total: <strong id="alarm-total-counter" class="text-rose-400 font-mono">4.230</strong></span>
                                <span class="text-rose-400 font-semibold cursor-pointer hover:underline" id="alarm-cal-quick-select">Pilih 14 Nov</span>
                            </div>
                        </div>

                        <!-- Action Buttons Under Date/Calendar (3 Buttons Row) -->
                        <div class="grid grid-cols-3 gap-2.5 mt-3">
                            <button type="button" id="btn-alarm-mode" class="w-full py-2 px-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs rounded-lg shadow-sm shadow-rose-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                <span class="w-2 h-2 rounded-full bg-white animate-ping flex-shrink-0"></span>
                                <span class="truncate">Alarm Mode</span>
                            </button>
                            <button type="button" id="btn-export-alarm-csv" onclick="exportAlarmDataCSV()" class="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-emerald-500/50 text-xs font-semibold text-slate-200 hover:text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                <span class="truncate">Export to CSV</span>
                            </button>
                            <button type="button" onclick="switchTab('dashboard')" class="w-full py-2 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 hover:border-slate-500 text-xs font-semibold text-slate-300 hover:text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                                <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"/></svg>
                                <span>Exit</span>
                            </button>
                        </div>
                    </div>

                    <!-- Center Section: Snapshot Camera Frame (Col 4 - Matching Gambar 2) -->
                    <div class="xl:col-span-4 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg flex flex-col justify-between">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                Snapshot Kamera Portal
                            </h3>
                            <span id="alarm-snapshot-pilar-badge" class="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-bold">PILAR 115</span>
                        </div>

                        <div class="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex-1 min-h-[190px] flex items-center justify-center">
                            <!-- Image element for alarm snapshot -->
                            <img id="alarm-snapshot-img"
                                 src="/api/historis/snapshot/251114205030"
                                 alt="Snapshot Alarm"
                                 class="w-full h-full object-cover rounded">
                            
                            <!-- Overlays matching Gambar 2 -->
                            <div class="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 font-bold border border-emerald-500/30" id="alarm-snapshot-overlay">
                                PILAR 115 • 2025-11-14 15:14:13
                            </div>
                            <div class="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300" id="alarm-snapshot-idk-overlay">
                                IDK: 251114151413
                            </div>
                        </div>

                        <div class="mt-2 text-[11px] text-slate-400 text-center font-mono">
                            Klik baris tabel di bawah untuk melihat foto kendaraan & grafik spesifik
                        </div>
                    </div>

                    <!-- Right Section: Chart 116 & Chart 115 with Red Alarm Spikes (Col 4 - Matching Gambar 2) -->
                    <div class="xl:col-span-4 bg-[#0F1A30] border border-[#1A294A] rounded-xl p-4 shadow-lg space-y-3">
                        <!-- Chart Pilar 116 (Atas) -->
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-bold text-blue-400">Chart Pilar 116 (Portal Kanan)</span>
                                <span class="text-[10px] text-slate-400 font-mono">Det 1 & Det 2 (CPS)</span>
                            </div>
                            <div class="h-28">
                                <canvas id="chart-alarm-pilar116"></canvas>
                            </div>
                        </div>

                        <!-- Chart Pilar 115 (Bawah) -->
                        <div class="border-t border-slate-800/80 pt-2">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-bold text-cyan-400">Chart Pilar 115 (Portal Kiri)</span>
                                <span class="text-[10px] text-slate-400 font-mono">Det 1 & Det 2 (CPS)</span>
                            </div>
                            <div class="h-28">
                                <canvas id="chart-alarm-pilar115"></canvas>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Bottom Section: Event Alarm Table (Strictly 20 Data Items - Gambar 2 Replica) -->
                <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-5 shadow-lg">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                                <h3 class="text-sm font-bold text-white">Event Alarm Radiasi (20 Data Terakhir)</h3>
                            </div>
                            <p class="text-xs text-slate-400 mt-0.5">Daftar rekaman event alarm pilar portal (terbatas 20 event terbaru)</p>
                        </div>

                        <!-- Quick Filter Buttons -->
                        <div class="flex items-center gap-2 flex-wrap">
                            <div class="flex bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
                                <button class="alarm-filter-btn px-3 py-1 rounded text-cyan-400 bg-slate-800 font-semibold" data-alarm-filter="all">Semua (20)</button>
                                <button class="alarm-filter-btn px-3 py-1 rounded text-slate-400 hover:text-slate-200" data-alarm-filter="115">Pilar 115</button>
                                <button class="alarm-filter-btn px-3 py-1 rounded text-slate-400 hover:text-slate-200" data-alarm-filter="116">Pilar 116</button>
                                <button class="alarm-filter-btn px-3 py-1 rounded text-slate-400 hover:text-slate-200" data-alarm-filter="Belum">Belum ACK</button>
                            </div>

                            <button onclick="loadRecentAlarms(true); showToast('Memperbarui event alarm...', 'info')" 
                                    class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                </svg>
                                Segarkan (20)
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto max-h-[420px] border border-slate-800/80 rounded-lg">
                        <table class="w-full text-left text-xs">
                            <thead class="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold sticky top-0 bg-[#0F1A30] z-10 shadow-sm">
                                <tr>
                                    <th class="py-2.5 px-3">NO</th>
                                    <th class="py-2.5 px-3">IDK</th>
                                    <th class="py-2.5 px-3">WAKTU</th>
                                    <th class="py-2.5 px-3">PILAR</th>
                                    <th class="py-2.5 px-3">JENIS ALARM</th>
                                    <th class="py-2.5 px-3 text-cyan-400">DET A1 / A2</th>
                                    <th class="py-2.5 px-3 text-blue-400">DET B1 / B2</th>
                                    <th class="py-2.5 px-3">LATAR</th>
                                    <th class="py-2.5 px-3">STATUS ACK</th>
                                    <th class="py-2.5 px-3 text-center">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="table-alarm-tbody" class="divide-y divide-slate-800/80">
                                <tr><td colspan="10" class="py-8 text-center text-slate-500">Memuat event alarm...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>


            <!-- ==================================================== -->
            <!-- TAB 4: PILAR VIEW (Status Pilar)                     -->
            <!-- ==================================================== -->
            <div data-tab-view="pilar" class="space-y-6 hidden">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Pilar 115 -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-6 shadow-lg">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                            <div>
                                <h3 class="text-base font-bold text-cyan-400">Pilar 115 (Portal Sisi Kiri)</h3>
                                <p class="text-[11px] text-slate-400 font-mono mt-0.5">Rekaman Terakhir: <span id="pilar115-last-time" class="text-cyan-300 font-semibold">2025-11-14 09:56:26</span></p>
                            </div>
                            <span class="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-cyan-400"></span> Data Terakhir
                            </span>
                        </div>
                        <div class="space-y-3 text-xs">
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Detector A1 (Atas)</span>
                                <span id="pilar115-a1" class="font-mono text-slate-200 font-bold">1.160 cps (Threshold: 1.250)</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Detector A2 (Bawah)</span>
                                <span id="pilar115-a2" class="font-mono text-slate-200 font-bold">940 cps (Threshold: 1.100)</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Latar Alami (Background)</span>
                                <span id="pilar115-latar" class="font-mono text-slate-400">1095 / 989 cps</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Suhu Internal</span>
                                <span id="pilar115-temp" class="font-mono text-slate-200">35.2 °C</span>
                            </div>
                            <div class="flex justify-between py-1.5">
                                <span class="text-slate-400">Kelembaban Relatif (RH)</span>
                                <span id="pilar115-humidity" class="font-mono text-slate-200">44.2 %</span>
                            </div>
                        </div>
                    </div>

                    <!-- Pilar 116 -->
                    <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-6 shadow-lg">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                            <div>
                                <h3 class="text-base font-bold text-blue-400">Pilar 116 (Portal Sisi Kanan)</h3>
                                <p class="text-[11px] text-slate-400 font-mono mt-0.5">Rekaman Terakhir: <span id="pilar116-last-time" class="text-blue-300 font-semibold">2025-11-14 09:56:26</span></p>
                            </div>
                            <span class="px-2.5 py-1 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 font-mono flex items-center gap-1.5">
                                <span class="w-2 h-2 rounded-full bg-blue-400"></span> Data Terakhir
                            </span>
                        </div>
                        <div class="space-y-3 text-xs">
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Detector B1 (Atas)</span>
                                <span id="pilar116-b1" class="font-mono text-slate-200 font-bold">1.050 cps (Threshold: 1.250)</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Detector B2 (Bawah)</span>
                                <span id="pilar116-b2" class="font-mono text-slate-200 font-bold">850 cps (Threshold: 1.100)</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Latar Alami (Background)</span>
                                <span id="pilar116-latar" class="font-mono text-slate-400">1005 / 896 cps</span>
                            </div>
                            <div class="flex justify-between py-1.5 border-b border-slate-800">
                                <span class="text-slate-400">Suhu Internal</span>
                                <span id="pilar116-temp" class="font-mono text-slate-200">37.3 °C</span>
                            </div>
                            <div class="flex justify-between py-1.5">
                                <span class="text-slate-400">Kelembaban Relatif (RH)</span>
                                <span id="pilar116-humidity" class="font-mono text-slate-200">45.0 %</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!-- ==================================================== -->
            <!-- TAB 5: SISTEM VIEW (Koneksi Lokal & Log Aktivitas)   -->
            <!-- ==================================================== -->
            <div data-tab-view="sistem" class="space-y-6 hidden">
                <div id="system-status-container">
                    <div class="text-center py-8 text-slate-500">Memuat status koneksi lokal...</div>
                </div>

                <!-- Log Aktivitas Akses Web & Sistem -->
                <div class="bg-[#0F1A30] border border-[#1A294A] rounded-xl p-6 shadow-lg">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div>
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <h3 class="text-base font-bold text-white">Log Aktivitas Akses Web & Sistem</h3>
                            </div>
                            <p class="text-xs text-slate-400 mt-0.5">Riwayat aktivitas login/logout akun, pergantian database, dan status server terputus/terhubung</p>
                        </div>

                        <div class="flex items-center gap-2 flex-wrap">
                            <!-- Filter Buttons for Activity Log -->
                            <div class="flex bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
                                <button class="activity-filter-btn px-2.5 py-1 rounded text-cyan-400 bg-slate-800 font-semibold" data-activity-filter="all">Semua</button>
                                <button class="activity-filter-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200" data-activity-filter="AUTH">Login/Logout</button>
                                <button class="activity-filter-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200" data-activity-filter="SERVER">Server</button>
                                <button class="activity-filter-btn px-2.5 py-1 rounded text-slate-400 hover:text-slate-200" data-activity-filter="DB">Database</button>
                            </div>

                            <button onclick="clearActivityLogs()" class="px-3 py-1 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 text-xs rounded-lg border border-slate-700 transition-all flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                Bersihkan
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto max-h-[360px] border border-slate-800/80 rounded-lg">
                        <table class="w-full text-left text-xs">
                            <thead class="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold sticky top-0 bg-[#0F1A30] z-10 shadow-sm">
                                <tr>
                                    <th class="py-2.5 px-3">NO</th>
                                    <th class="py-2.5 px-3">WAKTU</th>
                                    <th class="py-2.5 px-3">TIPE AKTIVITAS</th>
                                    <th class="py-2.5 px-3">PENGGUNA / AKTOR</th>
                                    <th class="py-2.5 px-3">STATUS</th>
                                    <th class="py-2.5 px-3">DETAIL KETERANGAN</th>
                                </tr>
                            </thead>
                            <tbody id="table-activity-logs-tbody" class="divide-y divide-slate-800/80 font-mono">
                                <tr><td colspan="6" class="py-6 text-center text-slate-500 font-sans">Belum ada riwayat aktivitas terbaru.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </main>
    </div>

    <!-- Scripts -->
    <script src="/js/firebase-auth.js"></script>
    <script src="/js/app-rpm.js"></script>
    
    <script>
        // Helpers for Auth Error Box
        function setAuthError(msg) {
            const box = document.getElementById('auth-error-box');
            if (box) {
                if (msg) {
                    box.textContent = msg;
                    box.classList.remove('hidden');
                } else {
                    box.textContent = '';
                    box.classList.add('hidden');
                }
            }
        }

        // Tab auth toggle
        const tabLogin = document.getElementById('tab-btn-login');
        const tabSignup = document.getElementById('tab-btn-signup');
        const formLogin = document.getElementById('form-login');
        const formSignup = document.getElementById('form-signup');

        tabLogin.addEventListener('click', () => {
            setAuthError(null);
            tabLogin.className = 'flex-1 pb-2.5 text-sm font-semibold text-cyan-400 border-b-2 border-cyan-400 transition-all';
            tabSignup.className = 'flex-1 pb-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all';
            formLogin.classList.remove('hidden');
            formSignup.classList.add('hidden');
        });

        tabSignup.addEventListener('click', () => {
            setAuthError(null);
            tabSignup.className = 'flex-1 pb-2.5 text-sm font-semibold text-cyan-400 border-b-2 border-cyan-400 transition-all';
            tabLogin.className = 'flex-1 pb-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-all';
            formSignup.classList.remove('hidden');
            formLogin.classList.add('hidden');
        });

        // Form submit: Login
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            setAuthError(null);
            const btn = document.getElementById('btn-submit-login');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Memverifikasi...';

            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-password').value;

            const res = await window.rpmAuth.loginWithEmail(email, pass);
            btn.disabled = false;
            btn.innerHTML = origHtml;

            if (!res.success) {
                setAuthError(res.message);
                showToast(res.message || 'Login gagal', 'error');
            }
        });

        // Form submit: Sign Up / Register
        formSignup.addEventListener('submit', async (e) => {
            e.preventDefault();
            setAuthError(null);

            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const pass = document.getElementById('signup-password').value;
            const confirmPass = document.getElementById('signup-password-confirm').value;

            if (pass !== confirmPass) {
                setAuthError('Konfirmasi kata sandi tidak cocok. Harap masukkan sandi yang sama.');
                return;
            }

            const btn = document.getElementById('btn-submit-signup');
            const origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Mendaftarkan...';

            const res = await window.rpmAuth.signUpWithEmail(name, email, pass);
            btn.disabled = false;
            btn.innerHTML = origHtml;

            if (!res.success) {
                setAuthError(res.message);
                showToast(res.message || 'Pendaftaran gagal', 'error');
            }
        });

        // Google Sign-In Popup
        document.getElementById('btn-google-auth').addEventListener('click', async () => {
            setAuthError(null);
            const btn = document.getElementById('btn-google-auth');
            const btnText = document.getElementById('btn-google-text');
            const origText = btnText.textContent;
            btn.disabled = true;
            btnText.textContent = 'Membuka Google Popup...';

            const res = await window.rpmAuth.signInWithGoogle();
            btn.disabled = false;
            btnText.textContent = origText;

            if (!res.success) {
                setAuthError(res.message);
                showToast(res.message, 'error');
            }
        });

        document.getElementById('btn-demo-auth').addEventListener('click', () => {
            window.rpmAuth.loginAsDemo();
        });

        document.getElementById('btn-logout').addEventListener('click', () => {
            window.rpmAuth.logout();
        });
    </script>
</body>
</html>
