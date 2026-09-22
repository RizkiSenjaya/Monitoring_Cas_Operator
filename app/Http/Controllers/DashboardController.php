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
     * Get recent or all alarms
     */
    public function alarms(Request $request): JsonResponse
    {
        $limit = (int)$request->query('limit', 0);
        $date = $request->query('date');
        $alarms = $this->rpmService->getRecentAlarms($limit, $date);
        return response()->json([
            'status' => 'success',
            'total' => count($alarms),
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

    /**
     * Get historical charts filtered by:
     * - '1hour' : Real-time last 1 hour
     * - 'hour'  : Specific hour
     * - 'day'   : Specific day (24 hours)
     * - 'month' : Specific month (Daily)
     */
    public function chartsFiltered(Request $request): JsonResponse
    {
        $mode = $request->input('mode', '1hour');
        $params = [
            'date' => $request->input('date', '2025-11-14'),
            'hour' => (int)$request->input('hour', 8),
            'month' => $request->input('month', '2025-11'),
        ];

        $data = $this->rpmService->getHistoricalChartsFiltered($mode, $params);
        return response()->json([
            'status' => 'success',
            'data' => $data
        ]);
    }

    /**
     * High-speed 1-second live tick endpoint
     */
    public function tick(): JsonResponse
    {
        $tick = $this->rpmService->getLatestTick();
        return response()->json([
            'status' => 'success',
            'data' => $tick
        ]);
    }
}
