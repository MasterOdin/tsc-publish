import {
  ExecCommand,
  NpmRunCommand,
  CopyCommand,
  BulkCopyCommand,
} from '../src/command';

jest.mock('child_process');
import childProcess from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import colors from 'ansi-colors';
import { join } from 'path';
import temp from 'temp';

temp.track();

const mockSpawn = (childProcess.spawn as jest.Mock);

const consoleLog = console.log;
let consoleOutput: string[];
beforeAll(() => {
  colors.enabled = false;
  console.log = (msg: string): void => {
    consoleOutput.push(msg);
  };
});
beforeEach(() => consoleOutput = []);
afterAll(() => {
  colors.enabled = true;
  console.log = consoleLog;
});

describe('ExecCommand', () => {
  test('executes command', (done) => {
    const command = new ExecCommand('/cwd/directory', 'test_command');
    command.describe();
    expect(consoleOutput.length).toBe(2);
    expect(consoleOutput[0]).toBe('> ExecCommand');
    expect(consoleOutput[1]).toBe('>   test_command');
    command.execute().then((exitCode): void => {
      expect(exitCode).toEqual(0);
      expect(mockSpawn.mock.calls.length).toStrictEqual(1);
      expect((mockSpawn.mock.calls[0] as unknown[])[0]).toStrictEqual('test_command');
      expect((mockSpawn.mock.calls[0] as unknown[])[1]).toStrictEqual([]);
      expect((mockSpawn.mock.calls[0] as unknown[])[2]).toStrictEqual({
        stdio: 'inherit',
        cwd: '/cwd/directory',
      });
      done();
    }).catch((err) => {
      done(err);
    });
  });
});

describe('NpmCommand', () => {
  test('run npm command', (done) => {
    const command = new NpmRunCommand('/cwd/directory', 'build');
    command.describe();
    expect(consoleOutput.length).toBe(2);
    expect(consoleOutput[0]).toBe('> ExecCommand');
    expect(consoleOutput[1]).toBe('>   npm run build');
    command.execute().then((exitCode): void => {
      expect(exitCode).toEqual(0);
      done();
    }).catch((err) => {
      done(err);
    });
  });
});

describe('CopyCommand', () => {
  let src: string;
  let dst: string;

  beforeEach(() => {
    src = temp.mkdirSync();
    dst = temp.mkdirSync();
  });

  test('copy file', (done) => {
    writeFileSync(join(src, 'test'), 'hello world');
    const command = new CopyCommand(src, dst, 'test');
    command.describe();
    expect(consoleOutput.length).toBe(3);
    expect(consoleOutput[0]).toBe('> CopyCommand');
    expect(consoleOutput[1]).toBe(`   ${join(src, 'test')}`);
    expect(consoleOutput[2]).toBe(`   -> ${join(dst, 'test')}`);
    command.execute().then((exitCode): void => {
      expect(exitCode).toBe(0);
      expect(existsSync(join(src, 'test'))).toBe(true);
      expect(existsSync(join(dst, 'test'))).toBe(true);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  test('copy file with directory create', (done) => {
    mkdirSync(join(src, 'test'));
    writeFileSync(join(src, 'test', 'hello'), 'hello world');
    const command = new CopyCommand(src, dst, 'test/hello');
    command.describe();
    expect(consoleOutput.length).toBe(3);
    expect(consoleOutput[0]).toBe('> CopyCommand');
    expect(consoleOutput[1]).toBe(`   ${join(src, 'test', 'hello')}`);
    expect(consoleOutput[2]).toBe(`   -> ${join(dst, 'test', 'hello')}`);
    command.execute().then((exitCode): void => {
      expect(exitCode).toBe(0);
      expect(existsSync(join(src, 'test', 'hello'))).toBe(true);
      expect(existsSync(join(dst, 'test', 'hello'))).toBe(true);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  test('file does not exist', () => {
    expect.assertions(2);

    try {
      new CopyCommand(src, dst, 'test');
    }
    catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toHaveProperty('message', 'Can only copy files');
    }
  });
});

describe('BulkCopyCommand', () => {
  let src: string;
  let dst: string;

  beforeEach(() => {
    src = temp.mkdirSync();
    dst = temp.mkdirSync();
  });

  test('copy multiple files', (done) => {
    writeFileSync(join(src, 'test1'), 'hello');
    writeFileSync(join(src, 'test2'), 'world');
    writeFileSync(join(src, 'test3'), 'friend');
    mkdirSync(join(src, 'test'));
    writeFileSync(join(src, 'test', 'hello'), 'true');

    const command = new BulkCopyCommand(src, dst, ['test1', 'test2', 'test/hello']);
    command.describe();
    expect(consoleOutput.length).toBe(7);
    command.execute().then((exitCode): void => {
      expect(exitCode).toBe(0);
      expect(existsSync(join(src, 'test1'))).toBe(true);
      expect(existsSync(join(dst, 'test1'))).toBe(true);
      expect(existsSync(join(src, 'test2'))).toBe(true);
      expect(existsSync(join(src, 'test2'))).toBe(true);
      expect(existsSync(join(src, 'test3'))).toBe(true);
      expect(existsSync(join(dst, 'test3'))).toBe(false);
      expect(existsSync(join(src, 'test', 'hello'))).toBe(true);
      expect(existsSync(join(dst, 'test', 'hello'))).toBe(true);
      done();
    }).catch((err) => {
      done(err);
    });
  });
});
