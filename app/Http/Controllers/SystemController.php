<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
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

    /**
     * Get shared activity logs (visible to all users/browsers)
     */
    public function activityLogs(): JsonResponse
    {
        $file = 'activity_logs.json';
        $logs = [];
        if (Storage::exists($file)) {
            $raw = Storage::get($file);
            $logs = json_decode($raw, true) ?: [];
        }
        return response()->json([
            'status' => 'success',
            'data' => $logs
        ]);
    }

    /**
     * Append a new shared activity log entry
     */
    public function addActivityLog(Request $request): JsonResponse
    {
        $file = 'activity_logs.json';
        $logs = [];
        if (Storage::exists($file)) {
            $raw = Storage::get($file);
            $logs = json_decode($raw, true) ?: [];
        }

        $entry = [
            'id'     => 'log_' . time() . '_' . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 6),
            'time'   => date('Y-m-d H:i:s'),
            'type'   => $request->input('type', 'INFO'),
            'user'   => $request->input('user', 'Operator'),
            'status' => $request->input('status', 'Sukses'),
            'detail' => $request->input('detail', '-'),
        ];

        array_unshift($logs, $entry);
        if (count($logs) > 200) {
            $logs = array_slice($logs, 0, 200);
        }

        Storage::put($file, json_encode($logs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return response()->json(['status' => 'success', 'entry' => $entry]);
    }

    /**
     * Clear all activity logs
     */
    public function clearActivityLogs(): JsonResponse
    {
        Storage::put('activity_logs.json', '[]');
        return response()->json(['status' => 'success']);
    }

    /**
     * Download active database summary as CSV
     */
    public function downloadDbCsv(Request $request)
    {
        $db = $request->query('db', $this->rpmService->getActiveDb());
        $table = $request->query('table', 'tblOkupasi');

        $allowed = ['tblOkupasi', 'tblAlarm', 'tblLog', 'tbllatar'];
        if (!in_array($table, $allowed)) {
            return response()->json(['error' => 'Invalid table'], 400);
        }

        try {
            $pdo = $this->rpmService->getConnection($db);
            $stmt = $pdo->query("SELECT * FROM {$table} ORDER BY rowid DESC LIMIT 50000");
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            if (empty($rows)) {
                return response("Tidak ada data di tabel {$table}", 200)
                    ->header('Content-Type', 'text/csv')
                    ->header('Content-Disposition', "attachment; filename=\"{$db}_{$table}.csv\"");
            }

            $headers = array_keys($rows[0]);
            $csv = implode(',', $headers) . "\n";
            foreach ($rows as $row) {
                $cols = array_map(function($v) {
                    $v = str_replace('"', '""', (string)$v);
                    return '"' . $v . '"';
                }, $row);
                $csv .= implode(',', $cols) . "\n";
            }

            return response($csv, 200)
                ->header('Content-Type', 'text/csv; charset=UTF-8')
                ->header('Content-Disposition', "attachment; filename=\"{$db}_{$table}_" . date('Ymd_His') . ".csv\"");
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal membaca database: ' . $e->getMessage()], 500);
        }
    }
}
