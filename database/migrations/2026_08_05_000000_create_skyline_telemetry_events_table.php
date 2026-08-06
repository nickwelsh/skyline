<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use NickWelsh\Skyline\Persistence\TelemetryEventIndexer;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection(config('skyline.connection'))->create('skyline_telemetry_events', function (Blueprint $table): void {
            $table->string('event_id', 80)->primary();
            $table->char('trace_id', 32);
            $table->string('run_id', 64);
            $table->unsignedInteger('attempt_number')->nullable();
            $table->char('span_id', 16);
            $table->char('parent_span_id', 16)->nullable();
            $table->string('variant', 16);
            $table->unsignedInteger('event_index');
            $table->bigInteger('occurred_at');
            $table->string('level', 8);
            $table->string('name', 512)->nullable();
            $table->string('role', 32)->nullable();
            $table->unsignedTinyInteger('kind')->nullable();
            $table->string('status', 16)->nullable();
            $table->bigInteger('duration_us')->nullable();
            $table->text('message')->nullable();
            $table->json('context');
            $table->timestamps();

            $table->foreign('trace_id')->references('trace_id')->on('skyline_traces')->cascadeOnDelete();
            $table->foreign('run_id')->references('run_id')->on('skyline_runs')->cascadeOnDelete();
            $table->index(['occurred_at', 'event_id']);
            $table->index(['level', 'occurred_at']);
            $table->index(['run_id', 'occurred_at']);
        });

        $connection = DB::connection(config('skyline.connection'));
        $indexer = app(TelemetryEventIndexer::class);
        $connection->table('skyline_spans')->orderBy('id')->chunkById(500, function ($spans) use ($connection, $indexer): void {
            $events = $spans->flatMap(fn (object $span): array => $indexer->rows((array) $span))->all();
            if ($events !== []) {
                $connection->table('skyline_telemetry_events')->insertOrIgnore($events);
            }
        });
    }

    public function down(): void
    {
        Schema::connection(config('skyline.connection'))->dropIfExists('skyline_telemetry_events');
    }
};
