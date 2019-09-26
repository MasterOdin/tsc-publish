import {replaceString, modifyPackageJson, getAutoIncludeFiles} from '../src/utils';
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

describe('getAutoIncludeFiles', (): void => {
  test('test tsc-publish itself for auto-include files', (): void => {
    const expected = ['LICENSE', 'README.md'];
    expect(getAutoIncludeFiles(resolve(__dirname, '..'))).toEqual(expected);
  });
});
