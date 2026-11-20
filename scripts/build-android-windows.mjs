/**
 * Builds the arm64 Android APK on Windows without Developer Mode.
 *
 * Tauri's CLI compiles the Rust library, then tries to symlink it into the
 * Gradle project's jniLibs folder. Windows only allows that with
 * SeCreateSymbolicLinkPrivilege (Developer Mode), so this script reuses the
 * compiled library, copies it instead, and lets Gradle assemble the APK.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const root = process.cwd()
const release = !process.argv.includes('--debug')
const profile = release ? 'release' : 'debug'
const suffix = release ? 'Release' : 'Debug'
const androidHome = process.env.ANDROID_HOME
const ndkHome =
  process.env.NDK_HOME ??
  (androidHome ? path.join(androidHome, 'ndk', '27.0.12077973') : undefined)

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })
  return result.status ?? 1
}

if (process.platform !== 'win32') {
  console.error('Use `npm run android:build` outside Windows.')
  process.exit(1)
}
if (!androidHome || !existsSync(androidHome)) {
  console.error('ANDROID_HOME is not set to an existing Android SDK.')
  process.exit(1)
}
if (!ndkHome || !existsSync(ndkHome)) {
  console.error('NDK_HOME is not set; install NDK 27.0.12077973 or set NDK_HOME.')
  process.exit(1)
}
process.env.NDK_HOME = ndkHome

if (run('npm', ['run', 'build']) !== 0) process.exit(1)

// The CLI is expected to fail at the symlink step on this host; it still
// produces the compiled library, which is all the Gradle path needs.
const cliStatus = run('npx', [
  'tauri',
  'android',
  'build',
  '--target',
  'aarch64',
  '--apk',
  '--ci',
  ...(release ? [] : ['--debug']),
])
if (cliStatus === 0) {
  console.log('\nTauri produced the APK directly; nothing to bypass.')
  process.exit(0)
}

const library = path.join(
  root,
  'src-tauri',
  'target',
  'aarch64-linux-android',
  profile,
  'libapp_lib.so',
)
if (!existsSync(library)) {
  console.error(`\nThe Rust library is missing at ${library}. Check the Tauri output above.`)
  process.exit(1)
}

const jniDir = path.join(
  root,
  'src-tauri',
  'gen',
  'android',
  'app',
  'src',
  'main',
  'jniLibs',
  'arm64-v8a',
)
mkdirSync(jniDir, { recursive: true })
copyFileSync(library, path.join(jniDir, 'libapp_lib.so'))

const gradleDir = path.join(root, 'src-tauri', 'gen', 'android')
const gradlew = path.join(gradleDir, 'gradlew.bat')
const status = run(
  gradlew,
  [
    `assembleArm64${suffix}`,
    '-x',
    `rustBuildUniversal${suffix}`,
    '-x',
    `rustBuildArm64${suffix}`,
    '--no-daemon',
  ],
  gradleDir,
)
if (status !== 0) process.exit(status)

const apkDir = path.join(gradleDir, 'app', 'build', 'outputs', 'apk', 'arm64', profile)
const version = JSON.parse(
  readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
).version
const finalApk = path.join(apkDir, `Refs-Workspace-${version}-arm64.apk`)
const gradleSignedApk = path.join(apkDir, `app-arm64-${profile}.apk`)
const unsignedApk = path.join(apkDir, `app-arm64-${profile}-unsigned.apk`)
const builtApk = existsSync(gradleSignedApk) ? gradleSignedApk : unsignedApk
if (!existsSync(builtApk)) {
  console.error(`\nGradle finished but no APK exists at ${builtApk}.`)
  process.exit(1)
}

if (!release) {
  console.log(`\nInstallable debug APK: ${builtApk}`)
  process.exit(0)
}

// A local/CI keystore.properties makes Gradle sign the release itself.
if (builtApk === gradleSignedApk) {
  copyFileSync(gradleSignedApk, finalApk)
  console.log(`\nSigned arm64 APK: ${finalApk}`)
  process.exit(0)
}

// Otherwise fall back to the standard local debug key so it can be sideloaded.
// Replace this with your own keystore before distributing it.
const keystore = path.join(homedir(), '.android', 'debug.keystore')
const buildTools = path.join(androidHome, 'build-tools')
const toolsVersion = existsSync(buildTools)
  ? readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
  : undefined
if (!existsSync(keystore) || !toolsVersion) {
  console.log(`\nUnsigned release APK: ${builtApk}`)
  console.log('No debug keystore or build-tools found; sign it before installing.')
  process.exit(0)
}

const tools = path.join(buildTools, toolsVersion)
const signedApk = finalApk
const alignedApk = path.join(apkDir, 'aligned.apk')

if (run(path.join(tools, 'zipalign.exe'), ['-f', '4', builtApk, alignedApk]) !== 0) process.exit(1)
if (
  run(path.join(tools, 'apksigner.bat'), [
    'sign',
    '--ks',
    keystore,
    '--ks-pass',
    'pass:android',
    '--key-pass',
    'pass:android',
    '--ks-key-alias',
    'androiddebugkey',
    '--out',
    signedApk,
    alignedApk,
  ]) !== 0
) {
  process.exit(1)
}
unlinkSync(alignedApk)

console.log(`\nSigned (debug key) arm64 APK: ${signedApk}`)
