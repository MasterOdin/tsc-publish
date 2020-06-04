import { resolve } from 'path';
import { getCommands } from '../src/runner';
import { BulkCopyCommand, NpmRunCommand, ExecCommand } from '../src/command';

describe('getCommands', () => {
  test('null operation', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    expect(getCommands(cwd, cwd, {}, {})).toEqual([]);
  });

  test('different outDir', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    expect(getCommands(cwd, resolve(cwd, 'out'), {}, {})).toEqual([
      new BulkCopyCommand(cwd, resolve(cwd, 'out'), ['README.md']),
    ]);
  });

  test('package.json scripts', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    const packageJson = {
      scripts: {
        lint: "eslint",
        test: "jest",
        build: "tsc",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new NpmRunCommand(cwd, 'lint'),
      new NpmRunCommand(cwd, 'build'),
      new NpmRunCommand(cwd, 'test'),
    ]);
  });

  test('.publisherrc steps', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    const packageJson = {
      scripts: {
        lint: "eslint",
        test: "jest",
        build: "tsc",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {steps: ['lint', 'test', 'tsc']})).toEqual([
      new NpmRunCommand(cwd, 'lint'),
      new NpmRunCommand(cwd, 'test'),
      new ExecCommand(cwd, 'tsc'),
    ]);
  });

  test('typescript devDependency', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    const packageJson = {
      devDependencies: {
        typescript: "^3.9",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new ExecCommand(cwd, './node_modules/.bin/tsc'),
    ]);
  });

  test('typescript dependency', () => {
    const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
    const packageJson = {
      dependencies: {
        typescript: "^3.9",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new ExecCommand(cwd, './node_modules/.bin/tsc'),
    ]);
  });
});
