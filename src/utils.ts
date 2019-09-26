import {PackageJson} from './index';
import { resolve, basename, extname } from 'path';
import fs from 'fs';

export function replaceString(string: string, outDir: string): string {
  return string.replace(/^\.\//, '').replace(outDir.replace(/^\.\//, ''), '').replace(/^[./|/]/, '');
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
    for (const key in packageJson.bin) {
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

/**
 * Get the files that cannot be ignored by npmignore, regardless of
 * extension
 */
export function getAutoIncludeFiles(path: string): string[] {
  const AUTO_INCLUDE_FILES = ['README', 'LICENSE', 'LICENCE', 'CHANGELOG'];
  const files: string[] = [];
  for (const file of fs.readdirSync(path)) {
    const filePath = resolve(path, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      continue;
    }
    if (AUTO_INCLUDE_FILES.includes(basename(filePath, extname(filePath)).toUpperCase())) {
      files.push(file);
    }
  }
  return files;
}
