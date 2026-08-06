<?php

use NickWelsh\Skyline\Read\Capabilities;

it('exposes only supported Application capabilities', function (): void {
    expect((new Capabilities)->all())->toBe([
        'navigation' => [
            'jobs' => true,
            'runs' => true,
            'errors' => true,
            'logs' => true,
            'queues' => true,
            'query' => false,
            'dashboards' => false,
            'deployments' => false,
            'schedules' => false,
            'waitpoints' => false,
            'alerts' => false,
            'settings' => false,
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
        'errors' => [
            'view' => true,
            'assign' => false,
            'ignore' => false,
            'resolve' => false,
            'alerts' => false,
            'replay' => false,
            'cancel' => false,
            'versions' => false,
            'bulkActions' => false,
        ],
        'logs' => ['view' => true],
        'queues' => [
            'view' => true,
            'pause' => false,
            'concurrency' => false,
            'workers' => false,
            'rateLimits' => false,
        ],
        'shell' => [
            'appearance' => true,
            'sidebarCustomization' => true,
            'favorites' => true,
            'panelPersistence' => true,
            'shortcuts' => true,
            'account' => false,
            'notifications' => false,
            'jobGuidance' => false,
            'organizationSwitching' => false,
            'projectSwitching' => false,
            'environmentSwitching' => false,
            'accountOpening' => false,
        ],
        'help' => [
            'menu' => true,
            'shortcuts' => true,
            'askAi' => false,
            'documentation' => false,
            'status' => false,
            'suggestFeature' => false,
            'contact' => false,
            'changelog' => false,
        ],
    ]);
});
