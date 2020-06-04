#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
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

function runner(cwd: string, packagePath: string, packageJson: PackageJson, publisherRc: PublisherConfig, tsconfig: TsConfigJson): void {
  if (program.postInstall) {
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    let modified = false;

    if (packageJson.scripts['prepublishOnly']) {
      console.log('prepublishOnly already exists, doing nothing');
    }
    else {
      console.log('Adding prepublishOnly to prevent npm-publish');
      packageJson.scripts['prepublishOnly'] = 'echo "Do not run publish directly, run tsc-publish" && exit 1';
      modified = true;
    }

    if (!packageJson.scripts['tsc-publish']) {
      console.log('Adding tsc-publish script');
      packageJson.scripts['tsc-publish'] = 'tsc-publish';
      modified = true;
    }

    if (modified) {
      console.log(`Writing out modified package.json to ${packagePath}`);
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    }

    process.exit();
  }

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
          console.log(`> ${colors.red('ERR')} Failed to run npm publish, please review the output above.`);
        }
        else {
          console.log(`> ${colors.green('PUBLISHED')}`);
        }
      }
    }
  }).catch((err): void => {
    console.log();
    console.error(`${err.message}.`);
  });
}

program.version('0.5.2');

program
  .option('--dryrun, --dry-run', 'Do a dry-run of tsc-publish without publishing')
  .option('--postinstall, --post-install', 'Run post-install step for tsc-publish')
  .option('--no-checks', 'Will not run lint or test steps');

program.parse(process.argv);

// INIT_CWD is set when going through npm run or npm install
let cwd = process.env.INIT_CWD ? process.env.INIT_CWD : process.cwd();
while (!fs.existsSync(resolve(cwd, 'package.json'))) {
  if (cwd === resolve(cwd, '..')) {
    throw new Error("Could not find package.json file");
  }
  cwd = resolve(cwd, '..');
}

const packagePath = resolve(cwd, 'package.json');
let packageJson: PackageJson | undefined = undefined;
try {
  packageJson = JSON.parse(stripJsonComments(fs.readFileSync(packagePath, {encoding: 'utf8'})));
}
catch (exc) {
  console.error('Failed to parse package.json file');
  process.exit(1);
}

let publisherRc: PublisherConfig = {};
if (fs.existsSync(resolve(cwd, '.publisherrc'))) {
  publisherRc = JSON.parse(stripJsonComments(fs.readFileSync(resolve(cwd, '.publisherrc'), {encoding: 'utf8'})));
}

let tsconfig: TsConfigJson | undefined = undefined;
try {
  tsconfig = parseTsConfig(resolve(cwd, 'tsconfig.json'));
}
catch (exc) {
  console.error('Failed to parse tsconfig.json file');
  process.exit(1);
}

if (packageJson && tsconfig) {
  runner(cwd, packagePath, packageJson, publisherRc, tsconfig);
}
else {
  console.error('Failed to load package.json or tsconfig.json');
  process.exit(1);
}
