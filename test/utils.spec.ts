import {replaceString, modifyPackageJson} from '../src/utils';

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
    let actual = modifyPackageJson(
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
    let test = {devDependencies: {}, scripts: {prepublishOnly: 'test', test: 'foo'}};
    let expected = {scripts: {test: 'foo'}};
    expect(modifyPackageJson(test, '')).toEqual(expected);
  });
});
