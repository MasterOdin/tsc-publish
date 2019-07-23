import {PackageJson} from './index';

export function modifyPackageJson(packageJson: PackageJson, outDir: string): PackageJson {
  outDir = outDir.replace(/^\.\//, '');
  if (packageJson.main) {
    packageJson.main = packageJson.main.replace(/^\.\//, '').replace(outDir, '').replace(/^[\.\/|\/]/, '');
  }

  if (packageJson.types) {
    packageJson.types = packageJson.types.replace(/^\.\//, '').replace(outDir, '').replace(/^[\.\/|\/]/, '');
  }

  if (packageJson.bin) {
    for (let key in packageJson.bin) {
      packageJson.bin[key] = packageJson.bin[key].replace(/^\.\//, '').replace(outDir, '').replace(/^[\.\/|\/]/, '');
    }
  }

  // Remove block for running npm publish
  if (packageJson.scripts) {
    delete packageJson.scripts['prepublishOnly'];
  }
  delete packageJson.devDependencies;
  return packageJson;
}
