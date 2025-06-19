import { Project } from 'ts-morph';

export type ImportStatement = {
  moduleSpecifier: string;
  defaultImport?: string;
  namedImports: string[];
};

export function createImportStatement(importFilePath: string, importPath: string) {
  const injectFileAst = new Project({ skipAddingFilesFromTsConfig: true });
  injectFileAst.addSourceFileAtPath(importFilePath);

  // import 파일 존재 체크
  const importFile = injectFileAst.getSourceFile(importFilePath);
  if (!importFile) {
    throw new Error('Import file not found');
  }

  // import 파일 안에 export 존재 체크
  const exports = importFile.getExportedDeclarations();
  if (exports.size === 0) {
    throw new Error('No exports found');
  }

  // import 파일 안에 default export 가 있을 경우, 나머지는 무시되고, default 임포트만 추출
  if (exports.has('default')) {
    const defaultExport = exports.get('default')![0];
    const name = (defaultExport as any).getName?.() || defaultExport?.getSymbol()?.getName();
    return {
      moduleSpecifier: importPath,
      defaultImport: name,
      namedImports: [],
    } as ImportStatement;
  }

  // 네임드 임포트 처리(default 없는 경우, 첫번째 네임드 임포트만 추출)
  const firstExport = exports.values().next().value![0];
  const name = (firstExport as any).getName?.() || firstExport?.getSymbol()?.getName();
  return {
    moduleSpecifier: importPath,
    defaultImport: undefined,
    namedImports: [name],
  } as ImportStatement;
}
