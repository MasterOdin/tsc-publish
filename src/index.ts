#!/usr/bin/env node

import fs from 'fs';
import {spawn} from 'child_process';
import {resolve} from 'path';
import program from 'commander';
import colors from 'ansi-colors';

import {modifyPackageJson} from './utils';

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

interface Command {
  describe(): void;
  execute(): Promise<number>; 
}

class ExecCommand implements Command {
  public command: string;
  public args: string[];
  public cwd: string;

  public constructor(cwd: string, command: string, args: string[] = []) {
    this.cwd = cwd;
    this.command = command;
    this.args = args;
  }

  public describe(): void {
    console.log('> ExecCommand');
    console.log(`>   ${colors.cyan(`${this.command} ${this.args.join(' ')}`)}`);
  }

  public execute(): Promise<number> {
    return new Promise((resolve: any, reject: any): void => {
      spawn(this.command, this.args, {
        stdio: 'inherit',
        cwd: this.cwd
      }).on('error', (err): void => reject(err))
        .on('exit', (code: number): void => resolve(code));
    });
  }
}

class NpmCommand extends ExecCommand {
  public constructor(cwd: string, command: string[] | string) {
    if (typeof command === 'string') {
      command = [command];
    }
    super(cwd, 'npm', command);
  }
}

class NpmRunCommand extends NpmCommand {
  public constructor(cwd: string, command: string, args: string[] = []) {
    super(cwd, ['run', command].concat(args));
  }
}

class CopyCommand implements Command {
  public src: string;
  public dest: string;
  public constructor(src: string, dest: string) {
    this.src = src;
    this.dest = dest;
    if (!fs.existsSync(this.src) || !fs.lstatSync(this.src).isFile()) {
      throw new Error('Can only copy files');
    }
    /*if (!fs.existsSync(this.dest)) {
      throw new Error(`Dest does not exist: ${this.dest}`);
    }*/
  }

  public describe(): void {
    console.log('> CopyCommand');
    console.log(`>   ${colors.cyan(this.src)}`);
    console.log(`>   ${colors.cyan(this.dest)}`);
  }

  public async execute(): Promise<number> {
    fs.copyFileSync(this.src, this.dest);
    return 0;
  }
}

async function runCommands(commands: Command[]): Promise<void> {
  for (let command of commands) {
    console.log('> Running Command');
    command.describe();
    try {
      let code = await command.execute();
      if (code !== 0) {
        throw new Error('Error encountered running last command');
      }
      console.log(`> ${colors.green('DONE')}\n`);
    }
    catch (exc) {
      throw exc;
    }
  }
}

program.version('0.1.0');

program
  .option('--dry-run', 'Do a dry-run of tsc-publish without publishing');

program.parse(process.argv);

let cwd = process.cwd();
while (!fs.existsSync(resolve(cwd, 'package.json'))) {
  if (cwd === resolve(cwd, '..')) {
    throw new Error("Could not find package.json file");
  }
  cwd = resolve(cwd, '..');
}

let packagePath = resolve(cwd, 'package.json');
let packageJson: PackageJson = JSON.parse(fs.readFileSync(packagePath, {encoding: 'utf8'}));
let tsconfig: TsconfigJson = JSON.parse(fs.readFileSync(resolve(cwd, 'tsconfig.json'), {encoding: 'utf8'}));

let commands = [];

// Find lint action
if (packageJson.scripts) {
  for (let script of ['lint', 'tslint', 'eslint', 'tslint:check', 'eslint:check']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmRunCommand(cwd, script));
      break;
    }
  }
}

// Find test action
if (packageJson.scripts) {
  for (let script of ['test']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmRunCommand(cwd, script));
      break;
    }
  }
}

// Find build action
let buildStepFound = false;
if (packageJson.scripts) {
  for (let script of ['build', 'build_all']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmRunCommand(cwd, script));
      buildStepFound = true;
      break;
    }
  }
}

if (!buildStepFound) {
  let inDev = packageJson.devDependencies && packageJson.devDependencies['typescript'];
  let inDeps = packageJson.dependencies && packageJson.dependencies['typescript'];
  if (inDev || inDeps) {
    commands.push(new ExecCommand(cwd, './node_modules/bin/tsc'));
    buildStepFound = true;
  }
}

// TODO: check if tsc is installed in path

if (!buildStepFound) {
  throw new Error('No build step found');
}

for (let file_name of ['README.md', 'README', 'LICENSE.md', 'LICENSE']) {
  if (fs.existsSync(resolve(cwd, file_name))) {
    commands.push(new CopyCommand(resolve(cwd, file_name), resolve(cwd, 'dist', file_name)));
  }
  else if (fs.existsSync(resolve(cwd, file_name.toLowerCase()))) {
    commands.push(new CopyCommand(resolve(cwd, file_name.toLowerCase()), resolve(cwd, 'dist', file_name)));
  }
}

runCommands(commands).then((): void => {
  console.log('> Finished All Commands');
  if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
    console.log(`> Copying and fixing package.json into ${tsconfig.compilerOptions.outDir}`);
    packageJson = modifyPackageJson(packageJson, tsconfig.compilerOptions.outDir);
    console.log('done');
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
