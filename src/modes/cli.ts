import { getImportRealPath } from '~/lib/import-utils';
import { type CliOptions } from '../types';
import os from 'node:os';
import { runWrapComponents } from '~/core/wrap';

export async function run(options: CliOptions) {
  // 쉘에서 `~/` 경로를 입력하면 절대경로로 자동 변환 됨
  // 역으로 절대경로를 `~/` 경로로 변환 해야 함
  const importPath = options.importPath.replace(os.homedir(), '~');
  const importFilePath = getImportRealPath(importPath);
  if (!importFilePath) {
    throw new Error('Import file not found');
  }

  await runWrapComponents({
    importFilePath,
    importPath,
    target: options.target,
    targetComponent: options.targetComponent,
    props: options.props,
  });
}
