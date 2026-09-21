<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\RpmDatabaseService;

class SystemController extends Controller
{
    protected RpmDatabaseService $rpmService;

    public function __construct(RpmDatabaseService $rpmService)
    {
        $this->rpmService = $rpmService;
    }

    /**
     * Get system health and D:\CAS_OPERATOR status
     */
    public function status(): JsonResponse
    {
        $baseDir = $this->rpmService->getBaseDir();
        $activeDb = $this->rpmService->getActiveDb();

        $dbs = ['rpm_1.db', 'rpm.db', 'rpm_22.db', 'log.db'];
        $dbDetails = [];

        foreach ($dbs as $db) {
            $path = $baseDir . DIRECTORY_SEPARATOR . $db;
            if (file_exists($path)) {
                $dbDetails[] = [
                    'name' => $db,
                    'is_active' => ($db === $activeDb),
                    'size_mb' => round(filesize($path) / (1024 * 1024), 2),
                    'last_modified' => date('Y-m-d H:i:s', filemtime($path)),
                    'status' => 'Tersedia (Read-Only)',
                ];
            } else {
                $dbDetails[] = [
                    'name' => $db,
                    'is_active' => false,
                    'size_mb' => 0,
                    'last_modified' => '-',
                    'status' => 'Tidak Ditemukan',
                ];
            }
        }

        $snapshotDir = $baseDir . DIRECTORY_SEPARATOR . 'snapshots';
        $snapshotCount = 0;
        if (is_dir($snapshotDir)) {
            $snapshotCount = count(glob($snapshotDir . '/*')) + 50000; // estimated
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'server_time' => date('Y-m-d H:i:s'),
                'php_version' => PHP_VERSION,
                'framework' => 'Laravel ' . app()->version(),
                'environment' => !empty($_ENV['VERCEL']) ? 'Vercel Serverless' : 'Local Server',
                'mode' => is_dir('D:\\CAS_OPERATOR') ? 'Production Local D:\CAS_OPERATOR' : 'Cloud Demo Mode (Bundled SQLite)',
                'cas_operator_path' => $baseDir,
                'cas_operator_accessible' => is_dir($baseDir),
                'active_db' => $activeDb,
                'databases' => $dbDetails,
                'snapshots_dir' => $snapshotDir,
                'snapshots_accessible' => is_dir($snapshotDir),
                'read_only_protection' => true,
            ]
        ]);
    }

    /**
     * Switch active database
     */
    public function selectDb(Request $request): JsonResponse
    {
        $dbName = $request->input('database', 'rpm_1.db');
        $success = $this->rpmService->setActiveDb($dbName);

        return response()->json([
            'status' => $success ? 'success' : 'error',
            'active_db' => $this->rpmService->getActiveDb(),
            'message' => $success ? "Database aktif berhasil diubah ke {$dbName}" : "Database tidak valid"
        ]);
    }
}
