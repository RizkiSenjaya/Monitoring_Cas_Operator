<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HistorisController;
use App\Http\Controllers\SystemController;

/*
|--------------------------------------------------------------------------
| API Routes for RPM Web Monitoring
|--------------------------------------------------------------------------
*/

// Dashboard endpoints
Route::prefix('dashboard')->group(function () {
    Route::get('/stats', [DashboardController::class, 'stats']);
    Route::get('/alarms', [DashboardController::class, 'alarms']);
    Route::get('/pillars', [DashboardController::class, 'pillars']);
    Route::get('/charts', [DashboardController::class, 'charts']);
    Route::get('/charts-filtered', [DashboardController::class, 'chartsFiltered']);
    Route::get('/tick', [DashboardController::class, 'tick']);
});

// Historis endpoints (Sesuai Gambar 1 & Akses Data D:\CAS_OPERATOR)
Route::prefix('historis')->group(function () {
    Route::get('/available-dates', [HistorisController::class, 'availableDates']);
    Route::get('/vehicles', [HistorisController::class, 'vehicles']);
    Route::get('/alarm-vehicles', [HistorisController::class, 'alarmVehicles']);
    Route::get('/profile/{idk}', [HistorisController::class, 'profile']);
    Route::get('/snapshot/{idk}', [HistorisController::class, 'snapshot']);
});

// System endpoints
Route::prefix('system')->group(function () {
    Route::get('/status', [SystemController::class, 'status']);
    Route::post('/select-db', [SystemController::class, 'selectDb']);
});
