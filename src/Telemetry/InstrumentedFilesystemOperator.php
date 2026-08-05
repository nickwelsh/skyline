<?php

namespace NickWelsh\Skyline\Telemetry;

use League\Flysystem\DirectoryListing;
use League\Flysystem\FilesystemOperator;

final readonly class InstrumentedFilesystemOperator implements FilesystemOperator
{
    public function __construct(
        private FilesystemOperator $inner,
        private StorageInstrumentation $telemetry,
        private string $disk,
        private string $driver,
    ) {}

    public function fileExists(string $location): bool
    {
        return $this->record('exists', [$location], fn () => $this->inner->fileExists($location));
    }

    public function directoryExists(string $location): bool
    {
        return $this->record('directory_exists', [$location], fn () => $this->inner->directoryExists($location));
    }

    public function has(string $location): bool
    {
        return $this->record('exists', [$location], fn () => $this->inner->has($location));
    }

    public function read(string $location): string
    {
        return $this->record('read', [$location], fn () => $this->inner->read($location));
    }

    public function readStream(string $location)
    {
        return $this->record('read_stream', [$location], fn () => $this->inner->readStream($location));
    }

    public function listContents(string $location, bool $deep = self::LIST_SHALLOW): DirectoryListing
    {
        return $this->record('list', [$location], fn () => $this->inner->listContents($location, $deep));
    }

    public function lastModified(string $path): int
    {
        return $this->record('last_modified', [$path], fn () => $this->inner->lastModified($path));
    }

    public function fileSize(string $path): int
    {
        return $this->record('size', [$path], fn () => $this->inner->fileSize($path));
    }

    public function mimeType(string $path): string
    {
        return $this->record('mime_type', [$path], fn () => $this->inner->mimeType($path));
    }

    public function visibility(string $path): string
    {
        return $this->record('visibility', [$path], fn () => $this->inner->visibility($path));
    }

    public function write(string $location, string $contents, array $config = []): void
    {
        $this->record('write', [$location], fn () => $this->inner->write($location, $contents, $config), strlen($contents), $contents);
    }

    public function writeStream(string $location, $contents, array $config = []): void
    {
        $this->record('write_stream', [$location], fn () => $this->inner->writeStream($location, $contents, $config), $this->streamBytes($contents), $contents);
    }

    public function setVisibility(string $path, string $visibility): void
    {
        $this->record('set_visibility', [$path], fn () => $this->inner->setVisibility($path, $visibility));
    }

    public function delete(string $location): void
    {
        $this->record('delete', [$location], fn () => $this->inner->delete($location));
    }

    public function deleteDirectory(string $location): void
    {
        $this->record('delete_directory', [$location], fn () => $this->inner->deleteDirectory($location));
    }

    public function createDirectory(string $location, array $config = []): void
    {
        $this->record('create_directory', [$location], fn () => $this->inner->createDirectory($location, $config));
    }

    public function move(string $source, string $destination, array $config = []): void
    {
        $this->record('move', [$source, $destination], fn () => $this->inner->move($source, $destination, $config));
    }

    public function copy(string $source, string $destination, array $config = []): void
    {
        $this->record('copy', [$source, $destination], fn () => $this->inner->copy($source, $destination, $config));
    }

    public function __call(string $method, array $arguments): mixed
    {
        return $this->record($method, isset($arguments[0]) && is_string($arguments[0]) ? [$arguments[0]] : [], fn () => $this->inner->{$method}(...$arguments));
    }

    /** @param list<string> $paths */
    private function record(string $operation, array $paths, callable $callback, ?int $bytes = null, mixed $content = null): mixed
    {
        return $this->telemetry->record($this->disk, $this->driver, $operation, $paths, $callback, $bytes, $content);
    }

    private function streamBytes(mixed $stream): ?int
    {
        if (! is_resource($stream)) {
            return null;
        }

        $metadata = stream_get_meta_data($stream);
        $stat = fstat($stream);
        $offset = ftell($stream);

        if (! ($metadata['seekable'] ?? false) || ! is_array($stat) || ! is_int($stat['size'] ?? null) || ! is_int($offset)) {
            return null;
        }

        return max(0, $stat['size'] - $offset);
    }
}
