<?php

namespace NickWelsh\Skyline\Telemetry;

use PDO;
use PDOStatement;
use Throwable;

final class CapturingPdoStatement extends PDOStatement
{
    protected function __construct(private readonly SqlResultRegistry $results) {}

    public function execute(?array $params = null): bool
    {
        $executed = parent::execute($params);

        if ($executed && preg_match('/^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE)\b/i', $this->queryString)) {
            try {
                $this->results->recordAffected($this->queryString, parent::rowCount());
            } catch (Throwable) {
                // Capture can never alter database behavior.
            }
        }

        return $executed;
    }

    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array
    {
        $rows = parent::fetchAll($mode, ...$args);

        try {
            $this->results->recordRows($this->queryString, $rows);
        } catch (Throwable) {
            // Capture can never alter database behavior.
        }

        return $rows;
    }
}
