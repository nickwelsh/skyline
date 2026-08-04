<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prototype_records', function (Blueprint $table): void {
            $table->id();
            $table->string('kind');
            $table->string('value');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prototype_records');
    }
};
