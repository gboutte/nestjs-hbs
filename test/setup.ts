import { Logger } from '@nestjs/common';

// HandlebarsService logs one line per partial on *every* render (tmp_todo.md #1),
// which drowns the test output. Silence Nest's logger for the whole run.
Logger.overrideLogger(false);
