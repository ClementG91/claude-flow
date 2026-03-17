#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { loadConfig, saveConfig, scanTasks } from '@claude-flow/core';
import { startServer } from '@claude-flow/server';

const logo = `
  ╔═══════════════════════════════════╗
  ║                                   ║
  ║   ${chalk.hex('#f0760c')('Claude')} ${chalk.white('Flow')}                   ║
  ║   ${chalk.gray('Visual Task Workflow Manager')}    ║
  ║                                   ║
  ╚═══════════════════════════════════╝
`;

const program = new Command();

program
  .name('claude-flow')
  .description('Visual workflow manager for Claude Desktop scheduled tasks')
  .version('0.1.0');

program
  .command('start')
  .description('Start the Claude Flow server and open the web UI')
  .option('-p, --port <port>', 'Server port', '3710')
  .option('--no-open', 'Do not open browser automatically')
  .option('-d, --dir <path>', 'Custom tasks directory path')
  .action(async (opts) => {
    console.log(logo);

    const config = await loadConfig();

    // Apply custom directory if provided
    if (opts.dir) {
      config.tasksDirectory = opts.dir;
      await saveConfig(config);
    }

    const port = parseInt(opts.port, 10);

    // Scan tasks first
    const spinner = ora('Scanning scheduled tasks...').start();
    const tasks = await scanTasks(config.tasksDirectory);
    spinner.succeed(
      `Found ${chalk.hex('#f0760c')(tasks.length.toString())} tasks in ${chalk.gray(config.tasksDirectory)}`
    );

    // Start server
    const serverSpinner = ora('Starting server...').start();
    try {
      await startServer(port);
      serverSpinner.succeed(
        `Server running at ${chalk.hex('#f0760c')(`http://localhost:${port}`)}`
      );
    } catch (err) {
      serverSpinner.fail('Failed to start server');
      console.error(err);
      process.exit(1);
    }

    // Open browser
    if (opts.open !== false) {
      const url = `http://localhost:${port}`;
      await open(url);
      console.log(chalk.gray(`\n  Browser opened at ${url}`));
    }

    console.log(chalk.gray('\n  Press Ctrl+C to stop\n'));
  });

program
  .command('list')
  .description('List all scheduled tasks')
  .option('-d, --dir <path>', 'Custom tasks directory path')
  .action(async (opts) => {
    const config = await loadConfig();
    const dir = opts.dir || config.tasksDirectory;
    const tasks = await scanTasks(dir);

    if (tasks.length === 0) {
      console.log(chalk.yellow('No tasks found.'));
      console.log(chalk.gray(`Looked in: ${dir}`));
      return;
    }

    console.log(chalk.hex('#f0760c')(`\n  📋 ${tasks.length} Scheduled Tasks\n`));
    console.log(chalk.gray('  ─'.repeat(30)));

    for (const task of tasks) {
      console.log(`  ${chalk.white('●')} ${chalk.hex('#f0760c')(task.taskId)}`);
      console.log(`    ${chalk.gray(task.frontmatter.description)}`);
    }

    console.log(chalk.gray('\n  ─'.repeat(30)));
    console.log(chalk.gray(`  Directory: ${dir}\n`));
  });

program
  .command('config')
  .description('Show or update configuration')
  .option('--dir <path>', 'Set tasks directory')
  .option('--port <port>', 'Set default port')
  .option('--show', 'Show current config', true)
  .action(async (opts) => {
    const config = await loadConfig();

    if (opts.dir) {
      config.tasksDirectory = opts.dir;
      await saveConfig(config);
      console.log(chalk.green(`Tasks directory set to: ${opts.dir}`));
    }

    if (opts.port) {
      config.port = parseInt(opts.port, 10);
      await saveConfig(config);
      console.log(chalk.green(`Default port set to: ${opts.port}`));
    }

    if (opts.show) {
      console.log(chalk.hex('#f0760c')('\n  Claude Flow Configuration\n'));
      console.log(`  Tasks directory: ${chalk.white(config.tasksDirectory)}`);
      console.log(`  Default port:    ${chalk.white(config.port.toString())}`);
      console.log(`  Workflows:       ${chalk.white(config.workflows.length.toString())}`);
      console.log();
    }
  });

// Default command (no subcommand = start)
program.action(async () => {
  await program.commands.find((c) => c.name() === 'start')?.parseAsync(['node', 'start']);
});

program.parse();
