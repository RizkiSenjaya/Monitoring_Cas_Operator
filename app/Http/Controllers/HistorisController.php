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
     * Get alarm vehicle list for the specified date
     */
    public function alarmVehicles(Request $request): JsonResponse
    {
        $date = $request->query('date', '2025-11-14');
        $vehicles = $this->rpmService->getAlarmVehiclesByDate($date);

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

        // Fallback: Return clean vehicle placeholder image (truck silhouette matching Image 2)
        $fallback = public_path('images/no-vehicle-snapshot.jpg');
        if (file_exists($fallback)) {
            return response()->file($fallback, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'no-cache',
            ]);
        }

        return response('Vehicle image not available', 404);
    }

    /**
     * Stream a cached low-resolution thumbnail (Camera 01)
     */
    public function thumbnail(string $idk): Response
    {
        $thumbPath = $this->rpmService->getThumbnailPath($idk, 120, 80);

        if ($thumbPath && file_exists($thumbPath)) {
            return response()->file($thumbPath, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=604800',
            ]);
        }

        // Fallback: clean vehicle truck thumbnail placeholder
        $fallbackThumb = public_path('images/no-vehicle-thumb.jpg');
        if (file_exists($fallbackThumb)) {
            return response()->file($fallbackThumb, [
                'Content-Type' => 'image/jpeg',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        return response('Thumbnail not available', 404);
    }

    /**
     * Return batch thumbnails as Base64 Data URLs for high-speed PDF rendering
     */
    public function batchThumbnails(Request $request): JsonResponse
    {
        $idks = $request->input('idks', []);
        if (!is_array($idks)) {
            $idks = [];
        }

        $thumbnails = $this->rpmService->getBatchThumbnails($idks, 120, 80);

        return response()->json([
            'status' => 'success',
            'count' => count($thumbnails),
            'thumbnails' => $thumbnails
        ]);
    }
}

