<?php

namespace NickWelsh\Skyline\Read;

final class Capabilities
{
    /** @return array<string, array<string, bool>> */
    public function all(): array
    {
        return [
            'navigation' => [
                'jobs' => false,
                'runs' => true,
                'errors' => false,
                'logs' => false,
                'queues' => false,
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
            'shell' => [
                'appearance' => false,
                'sidebarCustomization' => false,
                'favorites' => false,
                'shortcuts' => true,
            ],
        ];
    }
}
