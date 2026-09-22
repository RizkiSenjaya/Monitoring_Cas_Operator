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

Route::get('/', function (\App\Services\RpmDatabaseService $rpmService) {
    return view('monitoring', [
        'activeDb' => $rpmService->getActiveDb()
    ]);
});

// Also provide direct web alias for /api routes to prevent session cookie / CSRF roadblocks
Route::prefix('api')->group(function () {
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/alarms', [DashboardController::class, 'alarms']);
    Route::get('/dashboard/pillars', [DashboardController::class, 'pillars']);
    Route::get('/dashboard/charts', [DashboardController::class, 'charts']);
    Route::get('/dashboard/charts-filtered', [DashboardController::class, 'chartsFiltered']);
    Route::get('/dashboard/tick', [DashboardController::class, 'tick']);

    Route::get('/historis/available-dates', [HistorisController::class, 'availableDates']);
    Route::get('/historis/vehicles', [HistorisController::class, 'vehicles']);
    Route::get('/historis/sensor-points', [HistorisController::class, 'sensorPoints']);
    Route::get('/historis/alarm-vehicles', [HistorisController::class, 'alarmVehicles']);
    Route::get('/historis/profile/{idk}', [HistorisController::class, 'profile']);
    Route::get('/historis/snapshot/{idk}', [HistorisController::class, 'snapshot']);
    Route::get('/historis/thumbnail/{idk}', [HistorisController::class, 'thumbnail']);
    Route::match(['get', 'post'], '/historis/batch-thumbnails', [HistorisController::class, 'batchThumbnails']);

    Route::get('/system/status', [SystemController::class, 'status']);
    Route::post('/system/select-db', [SystemController::class, 'selectDb']);
    Route::get('/system/activity-logs', [SystemController::class, 'activityLogs']);
    Route::post('/system/activity-logs', [SystemController::class, 'addActivityLog']);
    Route::delete('/system/activity-logs', [SystemController::class, 'clearActivityLogs']);
    Route::get('/system/download-csv', [SystemController::class, 'downloadDbCsv']);
});
