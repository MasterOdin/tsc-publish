#!/usr/bin/env node

import fs from 'fs';
import {exec} from 'child_process';
import {resolve} from 'path';
import program from 'commander';

interface PackageJson {
  name?: string;
  scripts?: {[key: string]: string};
  dependencies?: {[key: string]: string};
  devDependencies?: {[key: string]: string};
  main?: string;
  types?: string;
}

interface TsconfigJson {
  compilerOptions?: {
    outDir?: string;
  };
}

interface Command {
  describe(): string;
  execute(): Promise<void>; 
}

class ExecCommand implements Command {
  public command: string;
  public cwd: string;
  public constructor(command: string, cwd: string) {
    this.command = command;
    this.cwd = cwd;
  }

  public describe(): string {
    return `ExecCommand - ${this.command}`;
  }

  public execute(): Promise<void> {
    return new Promise((resolve: any, reject: any): void => {
      let opts = {
        cwd: this.cwd,
        encoding: 'utf8'
      };
      let execCommand = exec(this.command, opts, (err): void => {
        if (err) {
          reject(new Error(err.message));
        }
        resolve();
      });
  
      if (execCommand.stdout) {
        execCommand.stdout.on('data', (data): void => console.log(data));
      }
      if (execCommand.stderr) {
        execCommand.stderr.on('data', (data): void => console.error(data));
      }  
    });
  }
}

class NpmCommand extends ExecCommand {
  public constructor(command: string, cwd: string) {
    super(`npm run ${command}`, cwd);
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

  public describe(): string {
    return `CopyCommand '${this.src}' -> '${this.dest}'`;
  }

  public async execute(): Promise<void> {
    fs.copyFileSync(this.src, this.dest);
  }
}

async function runCommands(commands: Command[]): Promise<void> {
  for (let command of commands) {
    console.log(`== RUNNING COMMAND ${command.describe()} == `);
    try {
      await command.execute();
    }
    catch (exc) {
      //console.error(exc);
    }
  }
  return;
}

program.version('0.0.1');

program
  .option('-v, --verbose', 'verbose output')
  .option('--bugfix', 'increment bugfix version')
  .option('--minor', 'increment minor version')
  .option('--major', 'increment major version');

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
      commands.push(new NpmCommand(script, cwd));
      break;
    }
  }
}

// Find build action
let buildStepFound = false;
if (packageJson.scripts) {
  for (let script of ['build', 'build_all']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmCommand(script, cwd));
      buildStepFound = true;
      break;
    }
  }
}

if (!buildStepFound) {
  let inDev = packageJson.devDependencies && packageJson.devDependencies['typescript'];
  let inDeps = packageJson.dependencies && packageJson.dependencies['typescript'];
  if (inDev || inDeps) {
    commands.push(new ExecCommand('./node_modules/bin/tsc', cwd));
    buildStepFound = true;
  }
}

if (!buildStepFound) {
  throw new Error('No build step found');
}

/*
// Find any potential test steps
if (packageJson.scripts) {
  for (let script of ['test']) {
    if (packageJson.scripts[script]) {
      commands.push(new NpmCommand(script, cwd));
      break;
    }
  }
}
*/

for (let file_name of ['README.md', 'README', 'LICENSE.md', 'LICENSE']) {
  if (fs.existsSync(resolve(cwd, file_name))) {
    commands.push(new CopyCommand(resolve(cwd, file_name), resolve(cwd, 'dist', file_name)));
  }
  else if (fs.existsSync(resolve(cwd, file_name.toLowerCase()))) {
    commands.push(new CopyCommand(resolve(cwd, file_name.toLowerCase()), resolve(cwd, 'dist', file_name)));
  }
}

runCommands(commands).then((): void => {
  console.log("== FINISHED COMMANDS ==");
  if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.outDir) {
    let outDir = tsconfig.compilerOptions.outDir;
    if (packageJson.main) {
      packageJson.main = packageJson.main.replace(outDir, '').replace(/^[\.\/|\/]/, '');
    }
    if (packageJson.types) {
      packageJson.types = packageJson.types.replace(outDir, '').replace(/^[\.\/|\/]/, '');
    }

    delete packageJson.devDependencies;
    fs.writeFileSync(resolve(tsconfig.compilerOptions.outDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  }
});
