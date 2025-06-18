// pnpm dev -i src/comp.tsx -t "src/**/page.tsx"
// pnpm dev -i templates/comp1.tsx -t "src/**/page.tsx"
// pnpm dev -i templates/comp1.tsx -t "~/Workspace/monorepo-base/packages/ui/src/components/**/*.tsx" -e "s*.tsx"
// pnpm dev -i templates/comp1.tsx -t "~/Workspace/monorepo-base/packages/ui/src/components/**/a*.tsx" --import-path="~/templates/comp1"
// pnpm dev -i templates/comp1.tsx -t "~/Workspace/monorepo-base/packages/ui/src/components/**/*.tsx" --import-path="~/templates/button-ext" --target-component="span"

import { Command } from 'commander';
import pkg from '../package.json';
import fs from 'node:fs';
import z from 'zod/v4';
import 'colors';
import FastGlob from 'fast-glob';
import { Expression, Project, SourceFile, SyntaxKind } from 'ts-morph';
import { format } from 'prettier';

// 타입 정의
const Schema = z.object({
  action: z.literal(['wrap', 'unwrap']).default('wrap'),
  input: z
    .string({ message: 'Must be a file path' })
    .regex(/\.(js|jsx|ts|tsx)$/, { message: 'Must be a file path ending with .js, .jsx, .ts, or .tsx' }),
  target: z.string({ message: 'Must be a glob pattern' }),
  exclude: z.string().describe('exclude glob pattern').optional().default(''),
  importPath: z.string().describe('import path'),
  targetComponent: z.string().describe('target component name').optional().default(''),
  props: z.string().describe('add props string').optional().default(''),
  overwrite: z.boolean().describe('overwrite').default(false),
  config: z.string().describe('config file path').optional(),
});

const program = new Command();
// 옵션 정의
program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .option('--action <action>', 'action name', 'wrap')
  .option('-i, --input <input>', 'input file path')
  .option('-t, --target <target>', 'target glob pattern')
  .option('-e, --exclude <exclude>', 'exclude glob pattern')
  .option('--import-path <importPath>', 'import path')
  .option('-c, --target-component <component>', 'target component name')
  .option('-p, --props <props>', 'add props string')
  .option('-o, --overwrite', 'overwrite')
  .option('-f, --config', 'config file path')
  .parse();

// 옵션 파싱
const options = Schema.safeParse(program.opts());

// input 유효성 체크 오류 메시지 출력
if (!options.success) {
  console.log(z.prettifyError(options.error).red);
  process.exit(0);
}

// input 파일 존재 체크
try {
  fs.accessSync(options.data.input, fs.constants.F_OK);
} catch {
  console.error(`${options.data.input.grey} ${'is invalid input file path'.red}`);
  process.exit(0);
}

// target 대상 파일 유무 체크(갯수)
const files = FastGlob.sync(options.data.target, {
  ignore: [options.data.exclude],
  onlyFiles: true,
});

// 파일 존재 체크
if (files.length === 0) {
  console.error(`${options.data.target.grey} ${'is not found'.red}`);
  process.exit(0);
}

/**
 * -----------------------------------------------------------------------------
 * Import 문 생성 AST
 * -----------------------------------------------------------------------------
 */
const importStatement = { path: options.data.importPath, name: '', isDefault: false };

const injectFileAst = new Project({ skipAddingFilesFromTsConfig: true });
injectFileAst.addSourceFileAtPath(options.data.input);

// import 파일 존재 체크
const importFile = injectFileAst.getSourceFile(options.data.input);
if (!importFile) {
  console.log('Import file not found'.red);
  process.exit(0);
}

// import 파일 안에 export 존재 체크
const exports = importFile.getExportedDeclarations();
if (exports.size === 0) {
  console.log('No exports found'.red);
  process.exit(0);
}

// import 파일 안에 export
if (exports.has('default')) {
  const defaultExport = exports.get('default')![0];
  const name = (defaultExport as any).getName?.() || defaultExport?.getSymbol()?.getName();
  importStatement.name = name;
  importStatement.isDefault = true;
} else {
  const firstExport = exports.values().next().value![0];
  const name = (firstExport as any).getName?.() || firstExport?.getSymbol()?.getName();
  importStatement.name = name;
  importStatement.isDefault = false;
}

/**
 * -----------------------------------------------------------------------------
 * Target Component 정의
 * -----------------------------------------------------------------------------
 */
const targetComponent = options.data.targetComponent || null;

/**
 * -----------------------------------------------------------------------------
 * Target AST 프로젝트 초기화 & 파일 순회
 * -----------------------------------------------------------------------------
 */

// 중복 import 방지용 Set
const importedFiles = new Set<string>();

// Target AST 프로젝트 초기화
const project = new Project({ skipAddingFilesFromTsConfig: true });
project.addSourceFilesAtPaths(files);

// 파일 순회
const astFiles = project.getSourceFiles();
for (const file of astFiles) {
  const exports = file.getExportedDeclarations();
  for (const [, declarations] of exports) {
    for (const decl of declarations) {
      try {
        const type = decl.getType?.();
        const sig = type?.getCallSignatures?.()[0];
        const returnType = sig?.getReturnType();

        const isJsx = returnType?.getText().includes('React.JSX.Element');
        if (!isJsx) {
          continue;
        }

        // 컴포넌트 조회 완료
        const returns = decl.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        for (const ret of returns) {
          const expr = ret.getExpression();
          if (!expr) {
            continue;
          }

          // ParenthesizedExpression // ( ... )
          let inner = expr;
          if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
            inner = expr.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
          }

          // Target 이 루트이면,
          if (!targetComponent) {
            const originalText = inner.getText();
            addImportStatement(file);

            const isAlreadyWrapped =
              (inner.getKind() === SyntaxKind.JsxElement &&
                inner.asKindOrThrow(SyntaxKind.JsxElement).getOpeningElement().getTagNameNode().getText() ===
                  importStatement.name) ||
              (inner.getKind() === SyntaxKind.JsxSelfClosingElement &&
                inner.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getTagNameNode().getText() ===
                  importStatement.name);

            // 이미 감싸져 있는 경우는 스킵
            if (isAlreadyWrapped) {
              continue;
            }

            const propsText = options.data.props ? ` ${options.data.props}` : '';
            const wrapped = `<${importStatement.name}${propsText}>${originalText}</${importStatement.name}>`;
            inner.replaceWithText(wrapped);
            continue;
          }

          // 루트 수정
          modifyTargetComponent(file, inner);

          // 자식들 수정
          expr.getDescendants().forEach((node) => {
            modifyTargetComponent(file, node as Expression);
          });
        }
      } catch (error) {
        console.log(error);
      }
    }
  }

  await formatAndSave(file);
}

/**
 * -----------------------------------------------------------------------------
 * Target Component 코드 수정
 * -----------------------------------------------------------------------------
 */
function modifyTargetComponent(file: SourceFile, expr: Expression) {
  const isAlreadyWrapped =
    (expr.getKind() === SyntaxKind.JsxElement &&
      expr.asKindOrThrow(SyntaxKind.JsxElement).getOpeningElement().getTagNameNode().getText() ===
        importStatement.name) ||
    (expr.getKind() === SyntaxKind.JsxSelfClosingElement &&
      expr.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getTagNameNode().getText() === importStatement.name);

  if (isAlreadyWrapped) {
    return;
  }

  // 조회: JsxElement, JsxSelfClosingElement
  if (expr.getKind() === SyntaxKind.JsxElement) {
    const jsx = expr.asKindOrThrow(SyntaxKind.JsxElement);
    const tag = jsx.getOpeningElement().getTagNameNode().getText();
    if (tag === targetComponent) {
      addImportStatement(file);
      const propsText = options.data?.props ? ` ${options.data.props}` : '';
      const wrapped = `<${importStatement.name}${propsText}>${expr.getText()}</${importStatement.name}>`;
      expr.replaceWithText(wrapped);
    }
  }

  if (expr.getKind() === SyntaxKind.JsxSelfClosingElement) {
    const jsx = expr.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
    const tag = jsx.getTagNameNode().getText();
    if (tag === targetComponent) {
      addImportStatement(file);
      const propsText = options.data?.props ? ` ${options.data.props}` : '';
      const wrapped = `<${importStatement.name}${propsText}>${expr.getText()}</${importStatement.name}>`;
      expr.replaceWithText(wrapped);
    }
  }
}

/**
 * -----------------------------------------------------------------------------
 * Import 문 추가
 * -----------------------------------------------------------------------------
 */
function addImportStatement(file: SourceFile) {
  const filePath = file.getFilePath();
  if (importedFiles.has(filePath)) return; // ✅ 이미 처리한 파일이면 무시

  importedFiles.add(filePath); // ✅ 처음 들어온 파일만 통과

  const currentFileAllImports = file.getImportDeclarations();
  const alreadyImported = currentFileAllImports.some((importDeclaration) => {
    return (
      importDeclaration.getModuleSpecifierValue() === importStatement.path &&
      (importStatement.isDefault
        ? importDeclaration.getDefaultImport()?.getText() === importStatement.name
        : importDeclaration.getNamedImports().some((named) => named.getName() === importStatement.name))
    );
  });

  if (alreadyImported) {
    return;
  }

  file.addImportDeclaration(
    importStatement.isDefault
      ? {
          defaultImport: importStatement.name,
          moduleSpecifier: importStatement.path,
        }
      : {
          namedImports: [importStatement.name],
          moduleSpecifier: importStatement.path,
        }
  );
}

/**
 * -----------------------------------------------------------------------------
 * 코드 포맷팅 & 저장
 * -----------------------------------------------------------------------------
 */
async function formatAndSave(file: SourceFile) {
  const formatted = await format(file.getFullText(), {
    parser: 'typescript',
    printWidth: 120,
    singleQuote: true,
  });

  file.replaceWithText(formatted);
  await file.save();
}
