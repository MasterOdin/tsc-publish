import { resolve } from 'path';
import { getCommands } from '../src/runner';
import { BulkCopyCommand, NpmRunCommand, ExecCommand } from '../src/command';
import { PackageJson } from '../src/types';

const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
describe('getCommands', () => {
  test('null operation', () => {
    expect(getCommands(cwd, cwd, {}, {})).toEqual([]);
  });

  test('different outDir', () => {
    expect(getCommands(cwd, resolve(cwd, 'out'), {}, {})).toEqual([
      new BulkCopyCommand(cwd, resolve(cwd, 'out'), ['README.md']),
    ]);
  });

  test('package.json scripts', () => {
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
    const packageJson = {
      dependencies: {
        typescript: "^3.9",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new ExecCommand(cwd, './node_modules/.bin/tsc'),
    ]);
  });

  test('checks disabled', () => {
    const packageJson = {
      scripts: {
        lint: "eslint",
        test: "jest",
        build: "tsc",
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {}, false)).toEqual([
      new NpmRunCommand(cwd, 'build'),
    ]);
  });

  test.each([
    'lint',
    'tslint',
    'eslint',
    'tslint:check',
    'eslint:check',
  ])('recognizes lint command %s', (command) => {
    const packageJson: PackageJson = {};
    packageJson.scripts = {};
    packageJson.scripts[command] = 'foo';
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new NpmRunCommand(cwd, command),
    ]);
  });

  test.each([
    'build',
    'build_all',
    'compile',
  ])('recognizes build command %s', (command) => {
    const packageJson: PackageJson = {};
    packageJson.scripts = {};
    packageJson.scripts[command] = 'foo';
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([
      new NpmRunCommand(cwd, command),
    ]);
  });

  test('empty package directory', () => {
    expect(getCommands(
      resolve(__dirname, 'test_files', 'empty_package'),
      resolve(__dirname, 'test_files', 'empty_package', 'out'),
      {},
      {},
    )).toEqual([]);
  });
});
