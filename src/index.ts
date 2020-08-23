#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import { join } from 'path';
import { resolve } from 'path';
import colors from 'ansi-colors';
import program from 'commander';
import stripJsonComments from 'strip-json-comments';

import { Command } from './command';
import { getCommands } from './runner';
import { PackageJson, PublisherConfig } from './types';
import { modifyPackageJson, parseTsConfig } from './utils';

interface TsConfigJson {
  compilerOptions?: {
    outDir?: string;
  };
}

async function runCommands(commands: Command[]): Promise<void> {
  for (const command of commands) {
    console.log('> Running Command');
    command.describe();
    const code = await command.execute();
    if (code !== 0) {
      throw new Error('Error encountered running last command');
    }
    console.log(`${colors.green('DONE')}\n`);
  }
}

function init(cwd: string, packageJson: PackageJson): void {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  let modified = false;

  if (packageJson.scripts['prepublishOnly']) {
    console.log('prepublishOnly already exists, doing nothing');
  }
  else {
    console.log('Adding prepublishOnly to prevent npm-publish');
    packageJson.scripts['prepublishOnly'] = 'echo "Do not run publish directly, run publisher" && exit 1';
    modified = true;
  }

  if (!packageJson.scripts['publisher']) {
    console.log('Adding publisher script');
    packageJson.scripts['publisher'] = 'publisher';
    modified = true;
  }

  fs.writeFileSync(join(cwd, '.publisherrc.js'), `{
    // "steps": [],     // list of steps to run, defaults to lint, run, build
    // "outDir": "",    // directory to publish
    // "publish": true  // whether to run npm publish or not at end
}`);

  if (modified) {
    console.log(`Writing out modified package.json to ${packagePath}`);
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  }
}

function runner(cwd: string, packagePath: string, packageJson: PackageJson, publisherRc: PublisherConfig, tsconfig: TsConfigJson): void {
  const outDir = publisherRc.outDir || tsconfig.compilerOptions?.outDir || cwd;

  runCommands(getCommands(cwd, outDir, packageJson, publisherRc, program.checks)).then((): void => {
    console.log('> Finished All Commands');
    if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
      console.log(`> Copying and fixing package.json into ${tsconfig.compilerOptions.outDir}`);
      packageJson = modifyPackageJson(packageJson, tsconfig.compilerOptions.outDir);
      console.log(`${colors.green('DONE')}`);
      fs.writeFileSync(resolve(tsconfig.compilerOptions.outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    }

    if (publisherRc.publish !== false) {
      if (program.dryRun) {
        console.log();
        console.log(`> ${colors.yellow('Dry-run enabled, not running npm-publish')}`);
      }
      else {
        const child = spawnSync('npm', ['publish'], {
          cwd: resolve(cwd, 'dist'),
          stdio: 'inherit',
        });
        console.log();
        if (child.status !== 0) {
          console.error(`> ${colors.red('ERR')} Failed to run npm publish, please review the output above.`);
          process.exitCode = 1;
        }
        else {
          console.log(`> ${colors.green('PUBLISHED')}`);
        }
      }
    }
  }).catch((err: Error): void => {
    console.log();
    console.error(`${err.message}.`);
    process.exitCode = 1;
  });
}

let version: string;
if (fs.existsSync(join(__dirname, 'package.json'))) {
  version = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), {encoding: 'utf-8'})).version;
}
else {
  version = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json'), {encoding: 'utf-8'})).version;
}

program.version(version);

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
  packageJson = JSON.parse(stripJsonComments(fs.readFileSync(packagePath, {encoding: 'utf8'}))) as PackageJson;
}
catch (exc) {
  console.error('Failed to parse package.json file');
  process.exit(1);
}

let publisherRc: PublisherConfig = {};
if (fs.existsSync(resolve(cwd, '.publisherrc'))) {
  publisherRc = JSON.parse(stripJsonComments(fs.readFileSync(resolve(cwd, '.publisherrc'), {encoding: 'utf8'}))) as PublisherConfig;
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
  if (program.postInstall) {
    init(cwd, packageJson);
  }
  else {
    runner(cwd, packagePath, packageJson, publisherRc, tsconfig);
  }
}
else {
  console.error('Failed to load package.json or tsconfig.json');
  process.exit(1);
}
