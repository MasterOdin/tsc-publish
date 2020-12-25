import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import temp from 'temp';
import { getCommands, init } from '../src/runner';
import { BulkCopyCommand, NpmRunCommand, ExecCommand } from '../src/command';
import { PackageJson } from '../src/types';

temp.track();

const cwd = resolve(__dirname, 'test_files', 'test_flat_package');
describe('getCommands', () => {
  test('null operation', () => {
    expect(getCommands(cwd, cwd, {}, {})).toEqual([]);
  });

  test('different outDir', () => {
    expect(getCommands(cwd, resolve(cwd, 'out'), {}, {})).toEqual([new BulkCopyCommand(cwd, resolve(cwd, 'out'), ['README.md'])]);
  });

  test('package.json scripts', () => {
    const packageJson = {
      scripts: {
        lint: 'eslint',
        test: 'jest',
        build: 'tsc',
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
        lint: 'eslint',
        test: 'jest',
        build: 'tsc',
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
        typescript: '^3.9',
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([new ExecCommand(cwd, './node_modules/.bin/tsc')]);
  });

  test('typescript dependency', () => {
    const packageJson = {
      dependencies: {
        typescript: '^3.9',
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([new ExecCommand(cwd, './node_modules/.bin/tsc')]);
  });

  test('checks disabled', () => {
    const packageJson = {
      scripts: {
        lint: 'eslint',
        test: 'jest',
        build: 'tsc',
      },
    };
    expect(getCommands(cwd, cwd, packageJson, {}, false)).toEqual([new NpmRunCommand(cwd, 'build')]);
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
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([new NpmRunCommand(cwd, command)]);
  });

  test.each([
    'build',
    'build_all',
    'compile',
  ])('recognizes build command %s', (command) => {
    const packageJson: PackageJson = {};
    packageJson.scripts = {};
    packageJson.scripts[command] = 'foo';
    expect(getCommands(cwd, cwd, packageJson, {})).toEqual([new NpmRunCommand(cwd, command)]);
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

describe('init', (): void => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(jest.fn());
  });

  test('edit package.json and create publisherrc', () => {
    const cwd = temp.mkdirSync();
    const packagePath = join(cwd, 'package.json');
    writeFileSync(packagePath, '{}');
    init(cwd, packagePath);
    const packageJson = JSON.parse(readFileSync(
      packagePath,
      {encoding: 'utf8'},
    )) as PackageJson;
    expect(packageJson).toEqual({
      scripts: {
        prepublishOnly: 'echo "Do not run publish directly, run publisher" && exit 1',
        publisher: 'publisher',
      },
    });
    expect(existsSync(join(cwd, '.publisherrc.json'))).toBe(true);
  });

  test('do not overwrite existing prepublishOnly and publisher fields', () => {
    const cwd = temp.mkdirSync();
    const packagePath = join(cwd, 'package.json');
    writeFileSync(packagePath, JSON.stringify({
      scripts: {
        prepublishOnly: 'test',
        publisher: 'exit 1',
      },
    }));
    init(cwd, packagePath);
    const packageJson = JSON.parse(readFileSync(
      packagePath,
      {encoding: 'utf8'},
    )) as PackageJson;
    expect(packageJson).toEqual({
      scripts: {
        prepublishOnly: 'test',
        publisher: 'exit 1',
      },
    });
  });
});
