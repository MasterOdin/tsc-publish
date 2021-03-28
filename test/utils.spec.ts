import {replaceString, modifyPackageJson, getNonSrcFiles, shouldIncludeFile, parseTsConfig} from '../src/utils';
import { resolve } from 'path';

interface huskyPackage {
  scripts: {
    [key: string]: string
  }
}

const testCases = [
  ['./dist/index.js', './dist'],
  ['dist/index.js', './dist'],
  ['./dist/index.js', 'dist'],
  ['dist/index.js', 'dist'],
];

describe.each(testCases)('replaceString', (input: string, outDir: string): void => {
  test(`sets ${input} to index.js for ${outDir}`, (): void => {
    expect(replaceString(input, outDir)).toEqual('index.js');
  });
});

describe.each(testCases)('modifyPackageJson', (input: string, outDir: string): void => {
  test(`sets ${input} to index.js for ${outDir}`, (): void => {
    const actual = modifyPackageJson(
      {
        main: input,
        types: input,
        bin: {
          foo: 'test.js',
          bin: input,
        },
      },
      outDir,
    );
    expect(actual['main']).toEqual('index.js');
    expect(actual['types']).toEqual('index.js');
    expect(actual['bin']).toEqual({foo: 'test.js', bin: 'index.js'});
  });
});

describe('modifyPackageJson', (): void => {
  test('that prepublishOnly and devDependencies are deleted', (): void => {
    const test = {devDependencies: {}, scripts: {prepublishOnly: 'test', test: 'foo'}};
    const expected = {scripts: {test: 'foo'}};
    expect(modifyPackageJson(test, '')).toEqual(expected);
  });

  describe('stripping husky', () => {
    describe.each(['prepare', 'postinstall'])('%s', (script: string) => {
      test(`that ${script} with only husky is deleted`, (): void => {
        const test: huskyPackage = {scripts: {}};
        test.scripts[script] = 'husky install';
        const expected = {scripts: {}};
        expect(modifyPackageJson(test, '')).toEqual(expected);
      });

      test('that prepare with leading husky is stripped', (): void => {
        const test: huskyPackage = {scripts: {}};
        test.scripts[script] = 'husky install && npm run build';
        const expected: huskyPackage = {scripts: {}};
        expected.scripts[script] = 'npm run build';
        expect(modifyPackageJson(test, '')).toEqual(expected);
      });

      test('that prepare with husky in middle is stripped', (): void => {
        const test: huskyPackage = {scripts: {}};
        test.scripts[script] = 'npm run action && husky install && npm run build';
        const expected: huskyPackage = {scripts: {}};
        expected.scripts[script] = 'npm run action && npm run build';
        expect(modifyPackageJson(test, '')).toEqual(expected);
      });

      test('that prepare with following husky is stripped', (): void => {
        const test: huskyPackage = {scripts: {}};
        test.scripts[script] = 'npm run build && husky install';
        const expected: huskyPackage = {scripts: {}};
        expected.scripts[script] = 'npm run build';
        expect(modifyPackageJson(test, '')).toEqual(expected);
      });
    });
  });
});

describe('getNonSrcFiles', (): void => {
  test('test publisher itself for auto-include files', (): void => {
    const expected = ['.npmignore', 'LICENSE', 'README.md'];
    expect(getNonSrcFiles(resolve(__dirname, '..'))).toEqual(expected);
  });

  test('test src_files_1 with .npmignore', (): void => {
    const expected = ['.npmignore', 'LICENSE', 'README'];
    expect(getNonSrcFiles(resolve(__dirname, 'test_files', 'src_files_1'))).toEqual(expected);
  });
});

const filterTestCases = [
  ['.npmignore', '', true],
  ['.gitignore', '', false],
  ['.git/some/file', '', false],
  ['.hg/some/file', '', false],
  ['node_modules/some/module', '', false],
  ['.DS_Store', '', false],
  ['outDir/file', 'outDir', false],
];

describe.each(filterTestCases)('shouldIncludeFile', (entry, outDir, expected): void => {
  test(`should ${expected ? 'include' : 'exclude'} file ${entry as string}`, (): void => {
    expect(shouldIncludeFile((entry as string), (outDir as string))).toEqual(expected);
  });
});

const tsconfigs = [
  'tsconfig.json',
  'tsconfig_comma.json',
  'tsconfig_comments.json',
];
describe.each(tsconfigs)('parseTsConfig', (file: string): void => {
  test(`test parsing ${file}`, (): void => {
    expect(parseTsConfig(resolve(__dirname, 'test_files', file))).toBeTruthy();
  });
});
