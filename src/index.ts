#!/usr/bin/env node

import fs from 'fs';
import { resolve } from 'path';
import program from 'commander';
import colors from 'ansi-colors';

import { Command, ExecCommand, NpmRunCommand, CopyCommand } from './command';
import { modifyPackageJson, getAutoIncludeFiles } from './utils';

export interface PackageJson {
  name?: string;
  scripts?: {[key: string]: string};
  dependencies?: {[key: string]: string};
  devDependencies?: {[key: string]: string};
  bin?: {[key: string]: string};
  main?: string;
  types?: string;
}

interface TsconfigJson {
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

program.version('0.3.0');

program
  .option('--dry-run, --dryrun', 'Do a dry-run of tsc-publish without publishing')
  .option('--post-install, --postinstall', 'Run post-install step for tsc-publish')
  .option('--no-checks', 'Will not run lint or test steps');

program.parse(process.argv);

let cwd = process.cwd();
while (!fs.existsSync(resolve(cwd, 'package.json'))) {
  if (cwd === resolve(cwd, '..')) {
    throw new Error("Could not find package.json file");
  }
  cwd = resolve(cwd, '..');
}

const packagePath = resolve(cwd, 'package.json');
let packageJson: PackageJson = JSON.parse(fs.readFileSync(packagePath, {encoding: 'utf8'}));
const tsconfig: TsconfigJson = JSON.parse(fs.readFileSync(resolve(cwd, 'tsconfig.json'), {encoding: 'utf8'}));

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

const commands = [];
let buildStepFound = false;

if (packageJson.scripts) {
  if (program.checks !== false) {  // Find lint action
    for (const script of ['lint', 'tslint', 'eslint', 'tslint:check', 'eslint:check']) {
      if (packageJson.scripts[script]) {
        commands.push(new NpmRunCommand(cwd, script));
        break;
      }
    }

    // Find test action
    for (const script of ['test']) {
      if (packageJson.scripts[script]) {
        commands.push(new NpmRunCommand(cwd, script));
        break;
      }
    }
  }

  // Find build action
  for (const script of ['build', 'build_all']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmRunCommand(cwd, script));
      buildStepFound = true;
      break;
    }
  }
}

if (!buildStepFound) {
  const inDev = packageJson.devDependencies && packageJson.devDependencies['typescript'];
  const inDeps = packageJson.dependencies && packageJson.dependencies['typescript'];
  if (inDev || inDeps) {
    commands.push(new ExecCommand(cwd, './node_modules/bin/tsc'));
    buildStepFound = true;
  }
}

// TODO: check if tsc is installed in path

if (!buildStepFound) {
  throw new Error('No build step found');
}

for (const file of getAutoIncludeFiles(cwd)) {
  commands.push(new CopyCommand(resolve(cwd, file), resolve(cwd, 'dist', file)));
}
console.log(commands.length);
process.exit();

runCommands(commands).then((): void => {
  console.log('> Finished All Commands');
  if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
    console.log(`> Copying and fixing package.json into ${tsconfig.compilerOptions.outDir}`);
    packageJson = modifyPackageJson(packageJson, tsconfig.compilerOptions.outDir);
    console.log(`${colors.green('DONE')}`);
    fs.writeFileSync(resolve(tsconfig.compilerOptions.outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  }

  if (program.dryRun) {
    console.log();
    console.log(`> ${colors.yellow('Dry-run enabled, not running npm-publish')}`);
  }
}).catch((err): void => {
  console.log();
  console.error(`${err.message}.`);
});
