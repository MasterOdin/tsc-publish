#!/usr/bin/env node

import fs from 'fs';
import { join } from 'path';
import { resolve } from 'path';
import colors from 'ansi-colors';
import program from 'commander';
import stripJsonComments from 'strip-json-comments';

import { DeleteCommand, NpmCommand, Command } from './command';
import { getCommands, init } from './runner';
import { PackageJson, PublisherConfig } from './types';
import { modifyPackageJson, parseTsConfig } from './utils';

interface TsConfigJson {
  compilerOptions?: {
    outDir?: string;
  };
}

async function runCommands(commands: Command[]): Promise<void> {
  for (const command of commands) {
    command.describe();
    const code = await command.execute();
    if (code !== 0) {
      throw new Error('Error encountered running last command');
    }
    console.log(`${colors.green('DONE')}\n`);
  }
}

function runner(cwd: string, packageJson: PackageJson, publisherRc: PublisherConfig, tsconfig: TsConfigJson): void {
  const outDir = publisherRc.outDir || tsconfig.compilerOptions?.outDir || cwd;

  const commands = getCommands(cwd, outDir, packageJson, publisherRc, program.checks);
  if (publisherRc.clean !== false) {
    commands.unshift(new DeleteCommand(outDir));
  }
  runCommands(commands).then((): void => {
    console.log('> Finished All Commands');
    if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
      console.log(`> Copying and fixing package.json into ${tsconfig.compilerOptions.outDir}`);
      packageJson = modifyPackageJson(packageJson, tsconfig.compilerOptions.outDir);
      console.log(`${colors.green('DONE')}`);
      fs.writeFileSync(resolve(tsconfig.compilerOptions.outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    }

    if (publisherRc.publish !== false) {
      console.log();
      if (program.dryRun) {
        console.log(`> ${colors.yellow('Dry-run enabled, not running npm-publish')}`);
      }
      else {
        const publishCommand = new NpmCommand(resolve(cwd, 'dist'), 'publish');
        publishCommand.describe();
        publishCommand.execute().then((exitCode: number) => {
          if (exitCode !== 0) {
            console.error(`> ${colors.red('ERR')} Failed to run npm publish, please review the output above.`);
            process.exitCode = exitCode;
          }
          else {
            console.log(`> ${colors.green('PUBLISHED')}`);
          }
        }).catch((err) => {
          console.error(err);
          console.error(`> ${colors.red('ERR')} Failed to run npm publish, please review the output above.`);
          process.exitCode = 1;
        });
      }
    }
  }).catch((err: Error): void => {
    console.log();
    console.error(`${err.message}.`);
    process.exitCode = 1;
  });
}

let filePath: string;
if (fs.existsSync(join(__dirname, 'package.json'))) {
  filePath = join(__dirname, 'package.json');
}
else {
  filePath = join(__dirname, '..', 'package.json');
}

program.version((JSON.parse(fs.readFileSync(filePath, {encoding: 'utf-8'})) as {version: string}).version);

program
  .option('--init', 'Initialize publisher for repository')
  .option('--dryrun, --dry-run', 'Do a dry-run of publisher without publishing')
  .option('--no-checks', 'Will not run lint or test steps');

program.parse(process.argv);

// INIT_CWD is set when going through npm run or npm install
let cwd = process.env.INIT_CWD ? process.env.INIT_CWD : process.cwd();
while (!fs.existsSync(resolve(cwd, 'package.json'))) {
  if (cwd === resolve(cwd, '..')) {
    throw new Error('Could not find package.json file');
  }
  cwd = resolve(cwd, '..');
}

const packagePath = resolve(cwd, 'package.json');
let packageJson: PackageJson;
try {
  packageJson = JSON.parse(stripJsonComments(fs.readFileSync(
    packagePath,
    {encoding: 'utf8'},
  ))) as PackageJson;
}
catch (exc) {
  console.error('Failed to parse package.json file');
  process.exit(1);
}

let publisherRc: PublisherConfig = {};
if (fs.existsSync(resolve(cwd, '.publisherrc'))) {
  publisherRc = JSON.parse(stripJsonComments(fs.readFileSync(
    resolve(cwd, '.publisherrc'),
    {encoding: 'utf8'},
  ))) as PublisherConfig;
}

let tsconfig: TsConfigJson;
try {
  tsconfig = parseTsConfig(resolve(cwd, 'tsconfig.json')) as TsConfigJson;
}
catch (exc) {
  console.error('Failed to parse tsconfig.json file');
  process.exit(1);
}

if (packageJson && tsconfig) {
  if (program.init) {
    init(cwd, packagePath);
  }
  else {
    runner(cwd, packageJson, publisherRc, tsconfig);
  }
}
else {
  console.error('Failed to load package.json or tsconfig.json');
  process.exit(1);
}
