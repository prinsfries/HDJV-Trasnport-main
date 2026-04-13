<?php

namespace App\Console\Commands;

use App\Services\RequestAutoRejectService;
use Illuminate\Console\Command;

class AutoRejectExpiredRequests extends Command
{
    protected $signature = 'requests:auto-reject-expired';
    protected $description = 'Auto-reject pending requests that are scheduled before today.';

    protected RequestAutoRejectService $autoRejectService;

    public function __construct(RequestAutoRejectService $autoRejectService)
    {
        parent::__construct();
        $this->autoRejectService = $autoRejectService;
    }

    public function handle(): int
    {
        $count = $this->autoRejectService->run();
        $this->info("Auto-rejected {$count} expired pending request(s).");
        return Command::SUCCESS;
    }
}
