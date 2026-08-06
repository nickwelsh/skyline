<?php

namespace NickWelsh\Skyline\Read;

final class Capabilities
{
    /** @return array<string, array<string, bool>> */
    public function all(): array
    {
        return [
            'navigation' => [
                'jobs' => true,
                'runs' => true,
                'errors' => false,
                'logs' => false,
                'queues' => true,
                'query' => false,
                'dashboards' => false,
            ],
            'runs' => [
                'view' => true,
                'cancel' => false,
                'replay' => false,
                'bulkCancel' => false,
                'bulkReplay' => false,
            ],
            'jobs' => [
                'view' => true,
                'testJob' => false,
                'configure' => false,
                'schedule' => false,
            ],
            'shell' => [
                'appearance' => false,
                'sidebarCustomization' => false,
                'favorites' => false,
                'shortcuts' => true,
            ],
        ];
    }
}
