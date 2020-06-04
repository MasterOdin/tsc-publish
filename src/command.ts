import { spawn } from 'child_process';
import fs from 'fs';
import { join, dirname } from 'path';

import colors from 'ansi-colors';


export interface Command {
  describe(): void;
  execute(): Promise<number>;
}

export class ExecCommand implements Command {
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
    return new Promise((resolve: (code: number) => void, reject: (err: unknown) => void): void => {
      spawn(this.command, this.args, {
        stdio: 'inherit',
        cwd: this.cwd,
      }).on('error', reject).on('exit', resolve);
    });
  }
}

export class NpmRunCommand extends ExecCommand {
  public constructor(cwd: string, command: string, args: string[] = []) {
    super(cwd, 'npm', ['run', command].concat(args));
  }
}

export class CopyCommand implements Command {
  public file: string;
  public src: string;
  public dest: string;
  public constructor(src: string, dest: string, file: string) {
    this.file = file;
    this.src = src;
    this.dest = dest;
    if (!fs.existsSync(join(this.src, this.file)) || !fs.lstatSync(join(this.src, this.file)).isFile()) {
      throw new Error('Can only copy files');
    }
    if (!fs.existsSync(join(this.dest, dirname(this.file)))) {
      fs.mkdirSync(join(this.dest, dirname(this.file)), {recursive: true});
    }
  }

  public describe(): void {
    console.log('> CopyCommand');
    console.log(`   ${colors.cyan(join(this.src, this.file))}`);
    console.log(`   -> ${colors.green(join(this.dest, this.file))}`);
  }

  public async execute(): Promise<number> {
    fs.copyFileSync(join(this.src, this.file), join(this.dest, this.file));
    return 0;
  }
}

export class BulkCopyCommand implements Command {
  public src: string;
  public dest: string;
  public files: string[];

  public constructor(src: string, dest: string, files: string[]) {
    this.src = src;
    this.dest = dest;
    this.files = files;
    for (const file of files) {
      if (!fs.existsSync(join(this.dest, dirname(file)))) {
        fs.mkdirSync(join(this.dest, dirname(file)), {recursive: true});
      }
    }
  }

  public describe(): void {
    console.log('> BulkCopyCommand');
    for (const file of this.files) {
      console.log(`   ${colors.cyan(join(this.src, file))}`);
      console.log(`   -> ${colors.green(join(this.dest, file))}`);
    }
  }

  public execute(): Promise<number> {
    return new Promise((resolve) => {
      const promises = [];
      for (const file of this.files) {
        promises.push(fs.promises.copyFile(join(this.src, file), join(this.dest, file)));
      }
      Promise.all(promises).then(() => resolve(0));
    });
  }
}
