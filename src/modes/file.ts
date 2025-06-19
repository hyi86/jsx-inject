import fs from 'node:fs';
import { runWrapComponents } from '~/core/wrap';
import { prettyLog } from '~/lib/console';
import { getImportRealPath } from '~/lib/import-utils';

export async function run(configFilePath: string) {
  const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
  prettyLog('process', 'Running in file mode...');

  if (!Array.isArray(config)) {
    throw new Error('Invalid config file structure.');
  }

  for (const item of config) {
    const importFilePath = getImportRealPath(item.importPath);
    if (!importFilePath) {
      throw new Error('Import file not found');
    }

    await runWrapComponents({
      importFilePath,
      importPath: item.importPath,
      target: item.target,
      targetComponent: item.targetComponent,
      props: item.props,
    });
  }
}
