import { resolve } from 'path';
import { Command, ExecCommand, NpmRunCommand, BulkCopyCommand } from './command';
import { PackageJson, PublisherConfig } from './types';
import { getNonSrcFiles } from './utils';

export function getCommands(cwd: string, outDir: string, packageJson: PackageJson, publisherRc: PublisherConfig, checks?: boolean): Command[] {
  const commands: Command[] = [];
  let buildStepFound = false;

  if (publisherRc.steps) {
    for (const step of publisherRc.steps) {
      if (packageJson.scripts && packageJson.scripts[step]) {
        commands.push(new NpmRunCommand(cwd, step));
      }
      else {
        commands.push(new ExecCommand(cwd, step));
      }
    }
  }
  else {
    if (packageJson.scripts) {
      if (checks !== false) {
        // Find lint action
        for (const script of ['lint', 'tslint', 'eslint', 'tslint:check', 'eslint:check']) {
          if (packageJson.scripts[script]) {
            commands.push(new NpmRunCommand(cwd, script));
            break;
          }
        }
      }

      // Find build action
      for (const script of ['build', 'build_all', 'compile']) {
        if (packageJson.scripts[script]) {
          commands.push(new NpmRunCommand(cwd, script));
          buildStepFound = true;
          break;
        }
      }

      if (checks !== false) {
        // Find test action
        for (const script of ['test']) {
          if (packageJson.scripts[script]) {
            commands.push(new NpmRunCommand(cwd, script));
            break;
          }
        }
      }
    }

    if (!buildStepFound) {
      const inDev = packageJson.devDependencies && packageJson.devDependencies['typescript'];
      const inDeps = packageJson.dependencies && packageJson.dependencies['typescript'];
      if (inDev || inDeps) {
        commands.push(new ExecCommand(cwd, './node_modules/.bin/tsc'));
      }
    }
  }

  if (outDir !== cwd) {
    const files = getNonSrcFiles(cwd, outDir);
    if (files.length > 0) {
      commands.push(new BulkCopyCommand(resolve(cwd), outDir, files));
    }

  }

  return commands;
}
