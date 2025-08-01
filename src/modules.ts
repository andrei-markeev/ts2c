import { getFileSystemWrapper } from "./fs";

export function getPossibleFilePaths(rootDir: string, curDir: string, moduleName: string) {
    const fileSystem = getFileSystemWrapper();
    let filePaths: string[] = [];
    if (moduleName.startsWith('.'))
        filePaths.push(
            fileSystem.path.join(curDir, moduleName + '.ts'),
            fileSystem.path.join(curDir, moduleName + '.js')
        );
    else
        filePaths.push(
            fileSystem.path.join(rootDir, 'node_modules', moduleName + '.d.ts'),
            fileSystem.path.join(rootDir, 'node_modules', moduleName + '.ts'),
            fileSystem.path.join(rootDir, 'node_modules', moduleName, 'index.d.ts'),
            fileSystem.path.join(rootDir, 'node_modules', moduleName, 'index.ts')
        );
    return filePaths;
}