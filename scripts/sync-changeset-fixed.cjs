#!/usr/bin/env node

/**
 * 自动同步 changeset fixed 配置
 * 根据 workspace 分组自动生成 fixed 配置，让每个 workspace 下的包统一版本号
 */

const fs = require('fs');
const path = require('path');

const glob = require('glob');

const ROOT_DIR = path.resolve(__dirname, '..');
const CHANGESET_CONFIG_PATH = path.join(ROOT_DIR, '.changeset/config.json');
const ROOT_PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');

/**
 * 读取根目录的 package.json 获取 workspaces 配置
 */
function getWorkspaces() {
  const pkg = JSON.parse(fs.readFileSync(ROOT_PACKAGE_JSON, 'utf-8'));
  return pkg.workspaces || [];
}

/**
 * 根据 workspace 模式查找所有包的 package.json
 */
function findPackagesInWorkspace(workspacePattern) {
  const pattern = path.join(ROOT_DIR, workspacePattern, 'package.json');
  return glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/example/**', '**/examples/**']
  });
}

/**
 * 读取 package.json 获取包名
 */
function getPackageName(packageJsonPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    // 跳过私有包和没有名字的包
    if (pkg.private || !pkg.name) {
      return null;
    }
    return pkg.name;
  } catch (error) {
    console.warn(`Warning: Failed to read ${packageJsonPath}:`, error.message);
    return null;
  }
}

/**
 * 按 workspace 分组获取所有包名
 */
function getPackagesByWorkspace() {
  const workspaces = getWorkspaces();
  const packagesByWorkspace = {};

  for (const workspace of workspaces) {
    const workspaceName = workspace.replace('/*', '').replace('/', '-');
    const packageJsonFiles = findPackagesInWorkspace(workspace);

    const packages = packageJsonFiles
      .map(getPackageName)
      .filter(Boolean)
      .sort();

    if (packages.length > 0) {
      packagesByWorkspace[workspaceName] = packages;
    }
  }

  return packagesByWorkspace;
}

/**
 * 读取当前的 changeset 配置
 */
function readChangesetConfig() {
  return JSON.parse(fs.readFileSync(CHANGESET_CONFIG_PATH, 'utf-8'));
}

/**
 * 写入更新后的 changeset 配置
 */
function writeChangesetConfig(config) {
  fs.writeFileSync(
    CHANGESET_CONFIG_PATH,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * 比较两个 fixed 配置是否相同
 */
function areFixedConfigsEqual(fixed1, fixed2) {
  if (fixed1.length !== fixed2.length) return false;

  const sorted1 = fixed1.map(group => [...group].sort()).sort();
  const sorted2 = fixed2.map(group => [...group].sort()).sort();

  return JSON.stringify(sorted1) === JSON.stringify(sorted2);
}

/**
 * 主函数
 */
function main() {
  const isCheckMode = process.argv.includes('--check');

  console.log('🔍 Scanning workspaces...\n');

  const packagesByWorkspace = getPackagesByWorkspace();

  // 打印扫描结果
  for (const [workspace, packages] of Object.entries(packagesByWorkspace)) {
    console.log(`📦 ${workspace}:`);
    packages.forEach(pkg => console.log(`   - ${pkg}`));
    console.log();
  }

  // 生成 fixed 配置
  const fixed = Object.values(packagesByWorkspace).filter(
    packages => packages.length > 1 // 只有多个包的 workspace 才需要 fixed
  );

  // 读取当前配置
  const config = readChangesetConfig();

  if (isCheckMode) {
    // 检查模式：验证配置是否同步
    console.log('🔍 Checking if changeset fixed configuration is up to date...\n');

    if (areFixedConfigsEqual(config.fixed, fixed)) {
      console.log('✅ Changeset fixed configuration is up to date!');
      return;
    } else {
      console.error('❌ Changeset fixed configuration is out of sync!');
      console.error('   Please run: pnpm changeset:sync-fixed\n');
      process.exit(1);
    }
  }

  // 更新模式
  console.log('📝 Updating .changeset/config.json...\n');
  config.fixed = fixed;
  writeChangesetConfig(config);

  console.log('✅ Successfully updated changeset fixed configuration!');
  console.log(`   Total workspace groups: ${fixed.length}`);
  console.log(`   Total packages in fixed groups: ${fixed.flat().length}\n`);

  // 打印最终的 fixed 配置
  console.log('📋 Fixed groups:');
  fixed.forEach((group, index) => {
    console.log(`\n   Group ${index + 1} (${group.length} packages):`);
    group.forEach(pkg => console.log(`   - ${pkg}`));
  });
}

// 运行脚本
try {
  main();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
