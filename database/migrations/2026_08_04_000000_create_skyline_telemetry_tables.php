<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection(config('skyline.connection'));

        $schema->create('skyline_traces', function (Blueprint $table): void {
            $table->char('trace_id', 32)->primary();
            $table->string('root_run_id', 64);
            $table->unsignedBigInteger('revision')->default(1);
            $table->bigInteger('last_activity_at')->index();
            $table->timestamps();
        });

        $schema->create('skyline_runs', function (Blueprint $table): void {
            $table->string('run_id', 64)->primary();
            $table->char('trace_id', 32);
            $table->string('parent_run_id', 64)->nullable()->index();
            $table->string('job_name')->default('unknown');
            $table->string('connection')->nullable();
            $table->string('queue')->nullable();
            $table->string('driver_id')->nullable();
            $table->string('status', 32)->default('dispatched');
            $table->bigInteger('triggered_at');
            $table->bigInteger('queued_at')->nullable();
            $table->bigInteger('started_at')->nullable();
            $table->bigInteger('finished_at')->nullable();
            $table->string('queue_time_source', 32)->nullable();
            $table->bigInteger('confirmed_at')->nullable();
            $table->timestamps();

            $table->foreign('trace_id')->references('trace_id')->on('skyline_traces')->cascadeOnDelete();
            $table->index(['trace_id', 'triggered_at']);
            $table->index(['status', 'triggered_at']);
            $table->index(['triggered_at', 'run_id']);
            $table->index(['connection', 'queue']);
            $table->index('job_name');
        });

        $schema->create('skyline_attempts', function (Blueprint $table): void {
            $table->id();
            $table->string('run_id', 64);
            $table->unsignedInteger('attempt_number');
            $table->string('status', 32)->default('running');
            $table->bigInteger('started_at');
            $table->bigInteger('finished_at')->nullable();
            $table->bigInteger('queue_time_ns')->nullable();
            $table->string('queue_time_source', 32)->nullable();
            $table->string('exception_class')->nullable();
            $table->text('exception_message')->nullable();
            $table->string('exception_code')->nullable();
            $table->text('exception_file')->nullable();
            $table->unsignedInteger('exception_line')->nullable();
            $table->longText('exception_trace')->nullable();
            $table->timestamps();

            $table->foreign('run_id')->references('run_id')->on('skyline_runs')->cascadeOnDelete();
            $table->unique(['run_id', 'attempt_number']);
            $table->index(['run_id', 'started_at']);
        });

        $schema->create('skyline_spans', function (Blueprint $table): void {
            $table->id();
            $table->char('trace_id', 32);
            $table->string('run_id', 64);
            $table->unsignedInteger('attempt_number')->nullable();
            $table->char('span_id', 16);
            $table->char('parent_span_id', 16)->nullable();
            $table->string('name', 512);
            $table->string('role', 32)->nullable();
            $table->unsignedTinyInteger('kind');
            $table->string('status_code', 16);
            $table->text('status_description')->nullable();
            $table->bigInteger('started_at');
            $table->bigInteger('ended_at');
            $table->json('attributes');
            $table->json('events');
            $table->json('links');
            $table->json('resource_attributes');
            $table->string('scope_name')->nullable();
            $table->string('scope_version')->nullable();
            $table->timestamps();

            $table->foreign('trace_id')->references('trace_id')->on('skyline_traces')->cascadeOnDelete();
            $table->foreign('run_id')->references('run_id')->on('skyline_runs')->cascadeOnDelete();
            $table->unique(['trace_id', 'span_id']);
            $table->index(['run_id', 'attempt_number', 'started_at']);
            $table->index(['trace_id', 'started_at']);
        });
    }

    public function down(): void
    {
        $schema = Schema::connection(config('skyline.connection'));

        $schema->dropIfExists('skyline_spans');
        $schema->dropIfExists('skyline_attempts');
        $schema->dropIfExists('skyline_runs');
        $schema->dropIfExists('skyline_traces');
    }
};
