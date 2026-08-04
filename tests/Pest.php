<?php

use Tests\CompatibilityTestCase;
use Tests\PersistenceTestCase;
use Tests\TestCase;

uses(TestCase::class)->in('Feature');
uses(PersistenceTestCase::class)->in('Persistence');
uses(CompatibilityTestCase::class)->in('Compatibility');
