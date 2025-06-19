import ts from 'typescript';
import path from 'node:path';
import { Project } from 'ts-morph';
import { configFilePath } from '~/config';

export function getImportRealPath(importPath: string) {
  const project = new Project({
    tsConfigFilePath: path.resolve(process.cwd(), 'tsconfig.json'),
  });
  const compilerOptions = project.getCompilerOptions();

  const resolved = ts.resolveModuleName(
    importPath,
    path.resolve(configFilePath), // from path
    compilerOptions,
    ts.sys
  );

  const resolvedPath = resolved.resolvedModule?.resolvedFileName;
  return resolvedPath;
}
