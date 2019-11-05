import {replaceString, modifyPackageJson, getNonSrcFiles, shouldIncludeFile, parseTsConfig} from '../src/utils';
import { resolve } from 'path';

const test_cases = [
  ['./dist/index.js', './dist'],
  ['dist/index.js', './dist'],
  ['./dist/index.js', 'dist'],
  ['dist/index.js', 'dist']
];

describe.each(test_cases)('replaceString', (input, outDir): void => {
  test(`sets ${input} to index.js for ${outDir}`, (): void => {
    expect(replaceString(input, outDir)).toEqual('index.js');
  });
});

describe.each(test_cases)('modifyPackageJson', (input, outDir): void => {
  test(`sets ${input} to index.js for ${outDir}`, (): void => {
    const actual = modifyPackageJson(
      {
        main: input,
        types: input,
        bin: {
          foo: 'test.js',
          bin: input
        }
      },
      outDir
    );
    expect(actual['main']).toEqual('index.js');
    expect(actual['types']).toEqual('index.js');
    expect(actual['bin']).toEqual({foo: 'test.js', bin: 'index.js'});
  });
});

describe('modifyPackageJson', (): void => {
  test('test that prepublishOnly and devDependencies are deleted', (): void => {
    const test = {devDependencies: {}, scripts: {prepublishOnly: 'test', test: 'foo'}};
    const expected = {scripts: {test: 'foo'}};
    expect(modifyPackageJson(test, '')).toEqual(expected);
  });
});

describe('getNonSrcFiles', (): void => {
  test('test tsc-publish itself for auto-include files', (): void => {
    const expected = ['LICENSE', 'README.md'];
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
  ['node_modules/some/module', '', false],
  ['.DS_Store', '', false]
];

describe.each(filterTestCases)('shouldIncludeFile', (entry, outDir, expected): void => {
  test(`should include file ${entry} from "${outDir}"`, (): void => {
    expect(shouldIncludeFile((entry as string), (outDir as string))).toEqual(expected);
  });
});

const tsconfigs = [
  'tsconfig.json',
  'tsconfig_comma.json',
  'tsconfig_comments.json'
];
describe.each(tsconfigs)('parseTsConfig', (file): void => {
  test(`test parsing ${file}`, (): void => {
    expect(parseTsConfig(resolve(__dirname, 'test_files', file))).toBeTruthy();
  });
});
