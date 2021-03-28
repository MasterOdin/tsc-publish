import { PackageJson } from './types';
import { join, resolve, basename, extname } from 'path';
import fs from 'fs';
import walk from 'ignore-walk';
import stripJsonComments from 'strip-json-comments';

const IGNORED_FILES = [
  '.DS_Store',
  '.npmrc',
  'npm-debug.log',
  'config.gypi',
  '.gitignore',
  'package.json',
  'package-lock.json',
  '.DS_Store',
];
const AUTO_INCLUDE_FILES = ['README', 'LICENSE', 'LICENCE', 'CHANGELOG'];

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
    delete packageJson.scripts.prepublishOnly;
    const huskyRegex = /(husky install(?: && )?| && husky install)/;
    if (packageJson.scripts.prepare) {
      packageJson.scripts.prepare = packageJson.scripts.prepare.replace(/(husky install(?: && )?| && husky install)/, '');
      if (packageJson.scripts.prepare === '') {
        delete packageJson.scripts.prepare;
      }
    }
    if (packageJson.scripts.postinstall) {
      packageJson.scripts.postinstall = packageJson.scripts.postinstall.replace(huskyRegex, '');
      if (packageJson.scripts.postinstall === '') {
        delete packageJson.scripts.postinstall;
      }
    }
  }
  delete packageJson.devDependencies;
  return packageJson;
}

export function shouldIncludeFile(entry: string, outDir: string): boolean {
  return (
    entry.substring(0, 5) !== '.git/'
    && entry.substring(0, 4) !== '.hg/'
    && entry.substring(0, 13) !== 'node_modules/'
    && (outDir === '' || entry.substring(0, outDir.length) !== outDir)
    && !(IGNORED_FILES.includes(entry))
  );
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
  const files: Set<string> = new Set();
  const strippedOutDir = stripLeadingSlash(outDir || '');
  if (fs.existsSync(join(path, '.npmignore'))) {
    const includeFiles = walk.sync({path: path, ignoreFiles: ['.npmignore']}).filter((entry) => {
      return shouldIncludeFile(entry, strippedOutDir);
    });
    includeFiles.forEach((entry) => files.add(entry));
  }

  for (const file of fs.readdirSync(path)) {
    const filePath = resolve(path, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      continue;
    }
    if (AUTO_INCLUDE_FILES.includes(basename(filePath, extname(filePath)).toUpperCase())) {
      files.add(file);
    }
  }
  return Array.from(files);
}

/**
 * Function to load the tsconfig.json file, which allows for both comments as well
 * as for trailing commas.
 * @param path
 */
export function parseTsConfig(path: string): unknown {
  const trailingCommaRegex = /,(?=\s*?[}\]])/g;
  return JSON.parse(stripJsonComments(fs.readFileSync(path, {encoding: 'utf8'})).replace(trailingCommaRegex, ''));
}
