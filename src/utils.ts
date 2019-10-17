import {PackageJson} from './index';
import { join, resolve, basename, extname } from 'path';
import fs from 'fs';
import walk from 'ignore-walk';

export function stripLeadingSlash(string: string): string {
  return string.replace(/^\.?\//, '');
}

export function replaceString(string: string, outDir: string): string {
  return stripLeadingSlash(stripLeadingSlash(string).replace(stripLeadingSlash(outDir), ''));
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
 * Gets list of files to include in the build folder.
 *
 * List of files will include files not ignored by .npmignore (if exists)
 * and always README, LICEN[CS]E, and CHANGELOG (if they exist).
 *
 * @param path path of directory to get files out of
 */
export function getNonSrcFiles(path: string, outDir?: string): string[] {
  const files: string[] = [];
  const strippedOutDir = stripLeadingSlash(outDir || '');
  if (fs.existsSync(join(path, '.npmignore'))) {
    files.push(...walk.sync({path: path, ignoreFiles: ['.npmignore']}).filter((entry) => {
      return (
        entry.substring(0, 5) !== '.git/'
        && (strippedOutDir === '' || entry.substring(0, strippedOutDir.length) !== strippedOutDir)
        && entry !== '.gitignore'
        && entry !== '.npmignore'
        && entry !== 'package.json'
        && entry !== 'package-lock.json'
      );
    }));
  }
  const AUTO_INCLUDE_FILES = ['README', 'LICENSE', 'LICENCE', 'CHANGELOG'];
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
