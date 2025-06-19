import { Expression, JsxElement, JsxSelfClosingElement, Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { createImportStatement } from './import-statements';
import { format } from 'prettier';
import { prettyLog } from '~/lib/console';

export type WrapOptions = {
  importFilePath: string;
  importPath: string;
  target: string[];
  targetComponent?: string;
  props?: string;
};

export async function runWrapComponents(options: WrapOptions) {
  const importStatement = createImportStatement(options.importFilePath, options.importPath);

  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths(options.target);

  const allSourceFiles = project.getSourceFiles();

  // import 가 필요한 파일 목록
  const willImportFiles = new Set<SourceFile>();

  // 노드 텍스트 수집 → 수정할 것만 모아서 나중에 처리
  const replacements: { node: JsxElement | JsxSelfClosingElement; wrapped: string; file: SourceFile }[] = [];

  prettyLog('process', 'Searching for target files...');
  prettyLog('info', `Target files: ${allSourceFiles.length}`);

  for (const file of allSourceFiles) {
    const allExports = file.getExportedDeclarations();
    if (allExports.size === 0) {
      continue;
    }

    for (const [, declarations] of allExports) {
      // decl: export 된 하나의 함수노드
      for (const decl of declarations) {
        const type = decl.getType?.();
        const sig = type?.getCallSignatures?.()[0];
        const returnType = sig?.getReturnType();
        // JSX 반환 타입만 체크
        if (returnType?.getText() !== 'React.JSX.Element') {
          continue;
        }

        // 각 함수의 return 문 조회
        const allReturnsByDecl = decl.getDescendantsOfKind(SyntaxKind.ReturnStatement);
        for (const returns of allReturnsByDecl) {
          let expr: Expression | undefined;
          try {
            expr = returns.getExpressionOrThrow();
          } catch {
            continue;
          }

          // 리턴문 중, 표현식만 조회
          let components = expr;
          // ParenthesizedExpression = return ( ... ) 에서 컴포넌트 괄호 제거
          if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
            components = expr.asKindOrThrow(SyntaxKind.ParenthesizedExpression).getExpression();
          }

          // <Component></Component> 또는 <Component /> 형태만 처리
          if (![SyntaxKind.JsxElement, SyntaxKind.JsxSelfClosingElement].includes(components.getKind())) {
            continue;
          }

          // targetComponent가 없으면 루트 컴포넌트로 처리
          // 즉, 모든 컴포넌트를 감싸는 형태로 처리
          if (!options.targetComponent) {
            let rootComponentTagName = '';
            if (Node.isJsxElement(components)) {
              rootComponentTagName = components
                .asKindOrThrow(SyntaxKind.JsxElement)
                .getOpeningElement()
                .getTagNameNode()
                .getText();
            }

            if (Node.isJsxSelfClosingElement(components)) {
              rootComponentTagName = components
                .asKindOrThrow(SyntaxKind.JsxSelfClosingElement)
                .getTagNameNode()
                .getText();
            }

            if (!rootComponentTagName) {
              console.log('rootComponentTagName is not found');
              continue;
            }

            // 이미 적용됨
            if (
              rootComponentTagName === importStatement.defaultImport ||
              importStatement.namedImports.includes(rootComponentTagName)
            ) {
              continue;
            }

            const importName = importStatement.defaultImport
              ? importStatement.defaultImport
              : importStatement.namedImports.at(0)!;
            const propsText = options.props ? ` ${options.props}` : '';
            const wrapped = `<${importName}${propsText}>${components.getText()}</${importName}>`;
            components.replaceWithText(wrapped);
            willImportFiles.add(file);
            continue;
          }

          // targetComponent 가 있으면, 해당 컴포넌트를 감싸는 형태로 처리
          const allNodes = [
            Node.isJsxElement(components) ? components : undefined,
            Node.isJsxSelfClosingElement(components) ? components : undefined,
            ...components.getDescendantsOfKind(SyntaxKind.JsxElement),
            ...components.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
          ].filter(Boolean) as (JsxElement | JsxSelfClosingElement)[];

          for (const node of allNodes) {
            const tagName =
              node.getKind() === SyntaxKind.JsxElement
                ? node.asKindOrThrow(SyntaxKind.JsxElement).getOpeningElement().getTagNameNode().getText()
                : node.asKindOrThrow(SyntaxKind.JsxSelfClosingElement).getTagNameNode().getText();

            if (tagName !== options.targetComponent) continue;

            const parent = node.getParent();
            const parentTagName =
              parent?.getKind() === SyntaxKind.JsxElement
                ? parent.asKindOrThrow(SyntaxKind.JsxElement).getOpeningElement().getTagNameNode().getText()
                : '';

            if (
              parentTagName === importStatement.defaultImport ||
              importStatement.namedImports.includes(parentTagName)
            ) {
              continue;
            }

            const importName = importStatement.defaultImport
              ? importStatement.defaultImport
              : importStatement.namedImports.at(0)!;
            const propsText = options.props ? ` ${options.props}` : '';
            const nodeText = node.getText();
            const wrapped = `<${importName}${propsText}>${nodeText}</${importName}>`;
            willImportFiles.add(file);
            replacements.push({ node, wrapped, file });
          }
        }
      }
    }
  }

  // import 가 필요한 파일에 import 문 추가
  if (willImportFiles.size > 0) {
    for (const file of willImportFiles) {
      const importDeclarations = file.getImportDeclarations().map((importDeclaration) => {
        return {
          moduleSpecifier: importDeclaration.getModuleSpecifierValue(), // 모듈 경로
          defaultImport: importDeclaration.getDefaultImport()?.getText(), // 기본 임포트
          namedImports: importDeclaration.getNamedImports().map((named) => named.getName()), // 네임드 임포트
        };
      });

      const isAlreadyImported = importDeclarations.some((importDeclaration) => {
        if (
          importDeclaration.moduleSpecifier === importStatement.moduleSpecifier &&
          importDeclaration.defaultImport === importStatement.defaultImport
        ) {
          return true;
        }

        if (
          importDeclaration.moduleSpecifier === importStatement.moduleSpecifier &&
          importDeclaration.namedImports.includes(importStatement.namedImports.at(0)!)
        ) {
          return true;
        }

        return false;
      });

      if (isAlreadyImported) {
        continue;
      }

      file.addImportDeclaration({
        moduleSpecifier: importStatement.moduleSpecifier,
        defaultImport: importStatement.defaultImport,
        namedImports: importStatement.namedImports,
      });
    }
  }

  prettyLog('info', `Replacements: ${replacements.length}`);

  // 노드 교체는 전부 수집 후 마지막에 실행
  for (const { node, wrapped, file } of replacements) {
    if (!node.wasForgotten()) {
      node.replaceWithText(wrapped);

      const formatted = await format(file.getFullText(), {
        parser: 'typescript',
        printWidth: 120,
        singleQuote: true,
      });

      file.replaceWithText(formatted);
      await file.save();
    }
  }
}
