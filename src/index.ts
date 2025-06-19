import { Command } from 'commander';
import pkg from '../package.json';
import { run as runCli } from './modes/cli';
import { run as runFile } from './modes/file';
import { cliSchema } from './types';
import fs from 'node:fs';
import { prettyLog, red, yellow } from './lib/console';

const configFilePath = 'jsx-inject.config.json';

const program = new Command();

program
  .name(pkg.name)
  .description(
    [
      'CLI Mode:',
      '  pnpx jsx-inject --import-path \'~/common/comp\' -t "src/components/*.tsx" "src/app/**/*.tsx"',
      '  pnpx jsx-inject --import-path \'@/comp\' -t "src/components/*.tsx" -c span',
      '',
      'File Mode(config file is required):',
      '  pnpx jsx-inject ',
    ].join('\n')
  )
  .version(pkg.version)
  .option('--import-path <importPath>', 'import path')
  .option('-t, --target <target...>', 'target glob pattern')
  .option('-c, --target-component <component>', 'target component name')
  .option('--props <props>', 'add props string')
  .parse();

try {
  const cliOptions = cliSchema.safeParse(program.opts());
  if (cliOptions.success) {
    await runCli(cliOptions.data);
  } else {
    prettyLog(
      'info',
      `CLI options are ${red('invalid')}. Running in file mode instead.`,
      yellow('(--import-path, --target options required)')
    );

    fs.accessSync(configFilePath, fs.constants.R_OK);
    await runFile(configFilePath);
  }
} catch (error) {
  prettyLog('error', error);
  process.exit(0);
}
