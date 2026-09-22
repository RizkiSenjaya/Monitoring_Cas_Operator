<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiEndpointsTest extends TestCase
{
    public function test_system_status_endpoint_returns_success(): void
    {
        $response = $this->getJson('/api/system/status');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data' => [
                         'server_time',
                         'php_version',
                         'framework',
                         'cas_operator_path',
                         'cas_operator_accessible',
                         'active_db',
                         'databases',
                     ]
                 ]);
    }

    public function test_dashboard_stats_returns_valid_data(): void
    {
        $response = $this->getJson('/api/dashboard/stats');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data' => [
                         'active_db',
                         'total_okupasi',
                         'total_alarm',
                     ]
                 ]);
    }

    public function test_dashboard_alarms_returns_list(): void
    {
        $response = $this->getJson('/api/dashboard/alarms');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data',
                 ]);
    }

    public function test_historis_available_dates(): void
    {
        $response = $this->getJson('/api/historis/available-dates');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data',
                 ]);
    }

    public function test_historis_vehicles(): void
    {
        $response = $this->getJson('/api/historis/vehicles?date=2025-11-14');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data',
                 ]);
    }

    public function test_historis_alarm_vehicles(): void
    {
        $response = $this->getJson('/api/historis/alarm-vehicles?date=2025-11-14');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data',
                 ]);
    }

    public function test_historis_thumbnail(): void
    {
        $response = $this->get('/api/historis/thumbnail/251114095622');
        $response->assertStatus(200);
    }

    public function test_historis_batch_thumbnails(): void
    {
        $response = $this->postJson('/api/historis/batch-thumbnails', [
            'idks' => ['251114095622']
        ]);
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'count',
                     'thumbnails'
                 ]);
    }

    public function test_dashboard_alarms_with_date_filter(): void
    {
        $response = $this->getJson('/api/dashboard/alarms?limit=0&date=2025-11-14');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'data',
                     'total',
                 ]);
    }

    public function test_historis_sensor_points_endpoint(): void
    {
        $response = $this->getJson('/api/historis/sensor-points?date=2025-11-14&limit=50');
        $response->assertStatus(200)
                 ->assertJsonStructure([
                     'status',
                     'date',
                     'count',
                     'data',
                 ]);
    }

    public function test_historis_empty_date_returns_zero_data(): void
    {
        // 2025-11-30 has no records in any database
        $response = $this->getJson('/api/historis/vehicles?date=2025-11-30');
        $response->assertStatus(200)
                 ->assertJson([
                     'status' => 'success',
                     'total' => 0,
                     'data' => [],
                 ]);

        $alarmResponse = $this->getJson('/api/historis/alarm-vehicles?date=2025-11-30');
        $alarmResponse->assertStatus(200)
                      ->assertJson([
                          'status' => 'success',
                          'total' => 0,
                          'data' => [],
                      ]);
    }
}

