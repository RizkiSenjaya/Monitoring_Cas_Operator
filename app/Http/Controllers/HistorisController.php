<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use App\Services\RpmDatabaseService;

class HistorisController extends Controller
{
    protected RpmDatabaseService $rpmService;

    public function __construct(RpmDatabaseService $rpmService)
    {
        $this->rpmService = $rpmService;
    }

    /**
     * Get available dates with data
     */
    public function availableDates(): JsonResponse
    {
        $dates = $this->rpmService->getAvailableDates();
        return response()->json([
            'status' => 'success',
            'data' => $dates
        ]);
    }

    /**
     * Get vehicle list for the specified date
     */
    public function vehicles(Request $request): JsonResponse
    {
        $date = $request->query('date', '2025-11-15');
        $vehicles = $this->rpmService->getVehiclesByDate($date);

        return response()->json([
            'status' => 'success',
            'date' => $date,
            'total' => count($vehicles),
            'data' => $vehicles
        ]);
    }

    /**
     * Get profile time-series data for a vehicle IDK
     */
    public function profile(string $idk): JsonResponse
    {
        $profile = $this->rpmService->getVehicleProfile($idk);

        return response()->json([
            'status' => 'success',
            'idk' => $idk,
            'data' => $profile
        ]);
    }

    /**
     * Stream the vehicle snapshot image (Camera 01)
     */
    public function snapshot(string $idk): Response
    {
        $imagePath = $this->rpmService->resolveSnapshotPath($idk);

        if ($imagePath && file_exists($imagePath)) {
            return response()->file($imagePath, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        // Fallback: Return a visually rich SVG placeholder indicating Camera 01 capture
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
  <rect width="640" height="360" fill="#0B132B"/>
  <rect x="20" y="20" width="600" height="320" rx="12" stroke="#1E293B" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="320" cy="150" r="45" fill="#132042" stroke="#00E5FF" stroke-width="2"/>
  <path d="M305 150H335M320 135V165" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
  <text x="320" y="225" fill="#94A3B8" font-family="sans-serif" font-size="14" font-weight="600" text-anchor="middle">SNAPSHOT KAMERA 01</text>
  <text x="320" y="250" fill="#64748B" font-family="sans-serif" font-size="12" text-anchor="middle">IDK: {$idk}</text>
  <rect x="30" y="30" width="130" height="28" rx="6" fill="#0F172A" fill-opacity="0.8"/>
  <text x="95" y="49" fill="#10B981" font-family="sans-serif" font-size="12" font-weight="700" text-anchor="middle">LIVE RPM CAM 01</text>
</svg>
SVG;

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
