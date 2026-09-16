<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HistorisController;
use App\Http\Controllers\SystemController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('monitoring');
});

// Also provide direct web alias for /api routes to prevent session cookie / CSRF roadblocks
Route::prefix('api')->group(function () {
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/alarms', [DashboardController::class, 'alarms']);
    Route::get('/dashboard/pillars', [DashboardController::class, 'pillars']);
    Route::get('/dashboard/charts', [DashboardController::class, 'charts']);

    Route::get('/historis/available-dates', [HistorisController::class, 'availableDates']);
    Route::get('/historis/vehicles', [HistorisController::class, 'vehicles']);
    Route::get('/historis/profile/{idk}', [HistorisController::class, 'profile']);
    Route::get('/historis/snapshot/{idk}', [HistorisController::class, 'snapshot']);

    Route::get('/system/status', [SystemController::class, 'status']);
    Route::post('/system/select-db', [SystemController::class, 'selectDb']);
});
