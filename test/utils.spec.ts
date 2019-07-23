import {modifyPackageJson} from '../src/utils';

const test_cases = [
  ['./dist/index.js', './dist'],
  ['dist/index.js', './dist'],
  ['./dist/index.js', 'dist'],
  ['dist/index.js', 'dist']
];

describe.each(test_cases)('modifyPackageJson', (input, outDir): void => {
  test(`sets ${input} to index.js for ${outDir}`, (): void => {
    let actual = modifyPackageJson({main: input}, outDir);
    expect(actual['main']).toEqual('index.js');
  });
});
