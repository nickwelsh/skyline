<?php

namespace NickWelsh\Skyline\Telemetry;

use BackedEnum;
use DateTimeInterface;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\Connection;
use Illuminate\Database\DatabaseManager;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Database\Events\QueryExecuted;
use PDO;
use PDOStatement;
use Psr\Log\LoggerInterface;
use Stringable;
use Throwable;

final class SqlCapture
{
    private bool $booted = false;

    /** @var array<int, true> */
    private array $installed = [];

    /** @var array<string, true> */
    private array $warnings = [];

    public function __construct(
        private readonly Repository $config,
        private readonly Dispatcher $events,
        private readonly DatabaseManager $database,
        private readonly SqlResultRegistry $results,
        private readonly SourceLocator $sourceLocator,
        private readonly LoggerInterface $logger,
    ) {}

    public function boot(): void
    {
        if (! $this->booted) {
            $this->booted = true;
            $this->events->listen(
                ConnectionEstablished::class,
                fn (ConnectionEstablished $event) => $this->install($event->connection),
            );
        }

        if (! $this->resultsEnabled()) {
            return;
        }

        foreach ($this->database->getConnections() as $connection) {
            $this->install($connection);
        }
    }

    /** @return array<string, string|int> */
    public function attributes(QueryExecuted $query, bool $include): array
    {
        $result = $this->results->consume($query->sql);

        if (! $include) {
            return [];
        }

        $attributes = [];

        if ((bool) $this->config->get('skyline.sql.capture_bindings', false)) {
            $attributes['skyline.sql.bindings'] = $this->bindings($query);
        }

        if ($this->resultsEnabled() && $result !== null) {
            $attributes['skyline.sql.result'] = $this->json($result);
        }

        if ((bool) $this->config->get('skyline.sql.capture_source', false)) {
            $attributes = [...$attributes, ...$this->sourceLocator->attributes('skyline.sql.source')];
        }

        return $attributes;
    }

    private function install(Connection $connection): void
    {
        if (! $this->resultsEnabled()
            || $connection->getName() === $this->config->get('skyline.storage_connection_name', 'skyline')
        ) {
            return;
        }

        try {
            $pdos = [$connection->getPdo(), $connection->getReadPdo()];

            if ($connection->getConfig('direct') !== null) {
                $pdos[] = $connection->getDirectPdo();
            }

            foreach ($pdos as $pdo) {
                $this->installPdo($pdo, $connection->getName());
            }
        } catch (Throwable $exception) {
            $this->warn($connection->getName(), 'Skyline could not enable SQL result capture.', $exception);
        }
    }

    private function installPdo(PDO $pdo, string $connection): void
    {
        $id = spl_object_id($pdo);

        if (isset($this->installed[$id])) {
            return;
        }

        $statement = $pdo->getAttribute(PDO::ATTR_STATEMENT_CLASS);
        $class = is_array($statement) ? ($statement[0] ?? PDOStatement::class) : PDOStatement::class;

        if ($class !== PDOStatement::class && $class !== CapturingPdoStatement::class) {
            $this->warn(
                $connection,
                "Skyline skipped SQL result capture because connection [{$connection}] uses a custom PDO statement class.",
            );

            return;
        }

        if ($class !== CapturingPdoStatement::class) {
            $pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [CapturingPdoStatement::class, [$this->results]]);
        }

        $this->installed[$id] = true;
    }

    private function bindings(QueryExecuted $query): string
    {
        try {
            $bindings = $query->connection->prepareBindings($query->bindings);
        } catch (Throwable) {
            $bindings = $query->bindings;
        }

        $columns = $this->bindingColumns($query->sql, count($bindings));
        $items = [];
        $truncated = false;
        $limit = max(256, (int) $this->config->get('skyline.sql.max_binding_bytes', 16_384));

        foreach (array_values($bindings) as $position => $value) {
            $column = $columns[$position] ?? null;
            $items[] = [
                'position' => $position,
                'column' => $column,
                'value' => $column !== null && $this->sensitive($column)
                    ? '[REDACTED]'
                    : $this->bindingValue($value),
            ];
            $preview = ['items' => $items, 'truncated' => $truncated];

            if (strlen($this->json($preview)) > $limit) {
                array_pop($items);
                $truncated = true;
                break;
            }
        }

        return $this->json(['items' => $items, 'truncated' => $truncated]);
    }

    /** @return list<string|null> */
    private function bindingColumns(string $sql, int $count): array
    {
        if ($count === 0) {
            return [];
        }

        if (preg_match('/^\s*insert\s+into\s+.+?\(([^)]+)\)\s+values\s*\(/is', $sql, $matches)) {
            $columns = array_values(array_filter(
                array_map($this->column(...), explode(',', $matches[1])),
                static fn (string $column): bool => $column !== '',
            ));

            if ($columns === []) {
                return array_fill(0, $count, null);
            }

            return array_map(
                static fn (int $position): ?string => $columns[$position % count($columns)] ?? null,
                range(0, $count - 1),
            );
        }

        preg_match_all(
            '/["`\[]?([a-z_][a-z0-9_.$]*)["`\]]?\s*(?:=|<>|!=|<=|>=|<|>|like)\s*\?/i',
            $sql,
            $matches,
        );

        return array_pad(array_map($this->column(...), $matches[1] ?? []), $count, null);
    }

    private function column(string $column): string
    {
        return trim(last(explode('.', trim($column))), " \t\n\r\0\x0B\"`[]");
    }

    private function bindingValue(mixed $value): mixed
    {
        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return $value;
        }

        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if ($value instanceof Stringable) {
            $value = (string) $value;
        }

        if (is_string($value)) {
            return preg_match('//u', $value) === 1
                ? mb_strcut($value, 0, 4_096, 'UTF-8')
                : '[BINARY '.strlen($value).' BYTES]';
        }

        return '['.strtoupper(get_debug_type($value)).']';
    }

    private function sensitive(string $column): bool
    {
        $column = strtolower($column);

        foreach ((array) $this->config->get('skyline.sql.redact_columns', []) as $pattern) {
            if (is_string($pattern) && $pattern !== '' && str_contains($column, strtolower($pattern))) {
                return true;
            }
        }

        return false;
    }

    private function resultsEnabled(): bool
    {
        return (bool) $this->config->get('skyline.sql.capture_results', false);
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    private function warn(string $key, string $message, ?Throwable $exception = null): void
    {
        if (isset($this->warnings[$key])) {
            return;
        }

        $this->warnings[$key] = true;

        try {
            $this->logger->warning($message, $exception === null ? [] : ['exception' => $exception]);
        } catch (Throwable) {
            // Monitoring failures cannot alter host behavior.
        }
    }
}
