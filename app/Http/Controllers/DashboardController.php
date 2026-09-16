<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\RpmDatabaseService;

class DashboardController extends Controller
{
    protected RpmDatabaseService $rpmService;

    public function __construct(RpmDatabaseService $rpmService)
    {
        $this->rpmService = $rpmService;
    }

    /**
     * Get top statistics cards and current detector status
     */
    public function stats(): JsonResponse
    {
        $stats = $this->rpmService->getDashboardStats();
        return response()->json([
            'status' => 'success',
            'data' => $stats
        ]);
    }

    /**
     * Get 50 recent alarms
     */
    public function alarms(): JsonResponse
    {
        $alarms = $this->rpmService->getRecentAlarms(50);
        return response()->json([
            'status' => 'success',
            'data' => $alarms
        ]);
    }

    /**
     * Get Pillar 115 & 116 summary
     */
    public function pillars(): JsonResponse
    {
        $pillars = $this->rpmService->getPillarsSummary();
        return response()->json([
            'status' => 'success',
            'data' => $pillars
        ]);
    }

    /**
     * Get daily charts and 1-hour realtime metrics
     */
    public function charts(): JsonResponse
    {
        $charts = $this->rpmService->getDailyHistoricalCharts();
        return response()->json([
            'status' => 'success',
            'data' => $charts
        ]);
    }
}
