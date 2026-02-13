#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 发布前检查脚本
 * 检查包配置、依赖关系和版本号
 */

function checkPackage(packagePath) {
  const packageJsonPath = path.join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log(`⚠️  ${path.basename(packagePath)}: 跳过（无package.json）`);
    return true; // 跳过而不是失败
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // 跳过 private 包
  if (packageJson.private === true) {
    console.log(`\n📦 ${packageJson.name || path.basename(packagePath)}: 跳过（private包）`);
    return true;
  }

  console.log(`\n📦 检查包: ${packageJson.name}`);

  // 检查必要字段
  const requiredFields = ['name', 'version', 'main', 'types'];
  let hasErrors = false;

  requiredFields.forEach(field => {
    if (!packageJson[field]) {
      console.log(`  ❌ 缺少字段: ${field}`);
      hasErrors = true;
    } else {
      console.log(`  ✅ ${field}: ${packageJson[field]}`);
    }
  });

  // 检查构建产物
  if (packageJson.main) {
    const mainPath = path.join(packagePath, packageJson.main);
    if (!fs.existsSync(mainPath)) {
      console.log(`  ❌ 主文件不存在: ${packageJson.main}`);
      hasErrors = true;
    }
  }

  // 检查workspace依赖
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  Object.entries(allDeps).forEach(([name, version]) => {
    if (version.startsWith('workspace:')) {
      console.log(`  ⚠️  workspace依赖: ${name}@${version}`);
    }
  });

  return !hasErrors;
}

// 读取根目录的 package.json 获取 workspaces 配置
const rootPackageJsonPath = path.join(__dirname, '../package.json');
const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const workspaces = rootPackageJson.workspaces || [];

console.log('📋 工作空间配置:', workspaces);

let allGood = true;

// 遍历所有 workspace 配置
workspaces.forEach(workspace => {
  // 处理通配符 (例如: apps/*, packages/*)
  const workspacePattern = workspace.replace(/\*/g, '');
  const workspaceDir = path.join(__dirname, '..', workspacePattern);

  if (!fs.existsSync(workspaceDir)) {
    console.log(`⚠️  工作空间目录不存在: ${workspace}`);
    return;
  }

  // 如果是通配符模式，遍历子目录
  if (workspace.endsWith('/*')) {
    const subDirs = fs.readdirSync(workspaceDir);
    subDirs.forEach(subDir => {
      const packagePath = path.join(workspaceDir, subDir);
      if (fs.statSync(packagePath).isDirectory()) {
        if (!checkPackage(packagePath)) {
          allGood = false;
        }
      }
    });
  } else {
    // 直接检查该目录
    if (!checkPackage(workspaceDir)) {
      allGood = false;
    }
  }
});

if (allGood) {
  console.log('\n✅ 所有包检查通过，可以发布！');
  process.exit(0);
} else {
  console.log('\n❌ 存在问题，请修复后再发布');
  process.exit(1);
}
