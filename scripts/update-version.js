const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Please provide a version number');
  process.exit(1);
}

// 更新根目录的 package.json
const rootPackagePath = path.join(__dirname, '../package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
rootPackage.version = newVersion;
fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2) + '\n');
console.log(`Updated root package version to ${newVersion}`);

// 更新 packages 目录下的所有包的版本
const packagesDir = path.join(__dirname, '../packages');
const packages = fs.readdirSync(packagesDir);

packages.forEach(pkg => {
  const packagePath = path.join(packagesDir, pkg, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkgJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkgJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`Updated ${pkgJson.name} version to ${newVersion}`);
  }
}); 
