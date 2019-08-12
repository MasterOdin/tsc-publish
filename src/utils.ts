import {PackageJson} from './index';

export function replaceString(string: string, outDir: string): string {
  return string.replace(/^\.\//, '').replace(outDir.replace(/^\.\//, ''), '').replace(/^[\.\/|\/]/, '');
}

export function modifyPackageJson(packageJson: PackageJson, outDir: string): PackageJson {
  outDir = outDir.replace(/^\.\//, '');
  if (packageJson.main) {
    packageJson.main = replaceString(packageJson.main, outDir);
  }

  if (packageJson.types) {
    packageJson.types = replaceString(packageJson.types, outDir);
  }

  if (packageJson.bin) {
    for (let key in packageJson.bin) {
      packageJson.bin[key] = replaceString(packageJson.bin[key], outDir);
    }
  }

  // Remove block for running npm publish
  if (packageJson.scripts) {
    delete packageJson.scripts['prepublishOnly'];
  }
  delete packageJson.devDependencies;
  return packageJson;
}
