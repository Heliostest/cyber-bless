import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const script = fileURLToPath(new URL('./windows.ps1', import.meta.url));
const source = await readFile(script, 'utf8');
const windows = process.platform === 'win32';
const ps = process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe') : 'powershell.exe';
const literal = text => `'${text.replaceAll("'", "''")}'`;
async function powershell(command) {
  return execute(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    `$ErrorActionPreference = 'Stop'; ${command}`], { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
}

test('Windows runner owns a kill-on-close job and assigns the suspended process before resuming', () => {
  assert.match(source, /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(source, /0x08000004/);
  assert.ok(source.indexOf('if (!AssignProcessToJobObject') < source.indexOf('if (ResumeThread'));
  assert.match(source, /finally[\s\S]*CloseHandle\(job\)/);
  assert.doesNotMatch(source, /Stop-Process|taskkill|Get-Process/);
  assert.match(source, /Local\\CyberBless-TestFeedback-/);
  assert.match(source, /WaitOne\(0\)/);
});

test('intentional stop disables recovery first and uninstall touches only the owned task', () => {
  const stop = source.slice(source.indexOf("'stop' {"), source.indexOf("'uninstall' {"));
  assert.ok(stop.indexOf('$task.Enabled = $false') < stop.indexOf('$task.Stop(0)'));
  const uninstall = source.slice(source.indexOf("'uninstall' {"), source.indexOf("'logs' {"));
  assert.match(uninstall, /Get-OwnedFeedbackTask/);
  assert.match(uninstall, /DeleteTask\(\$script:TaskName, 0\)/);
  assert.doesNotMatch(uninstall, /Remove-Item/);
  assert.match(source, /Description -ne \$script:TaskDescription/);
});

test('Windows PowerShell parses the script without errors', { skip: !windows }, async () => {
  const { stdout } = await powershell(`$tokens = $null; $errors = $null; ` +
    `[Management.Automation.Language.Parser]::ParseFile(${literal(script)}, [ref]$tokens, [ref]$errors) | Out-Null; ` +
    `if ($errors.Count) { throw ($errors | Out-String) }; Write-Output 'parsed'`);
  assert.match(stdout, /parsed/);
});

test('task definition uses limited current-user logon, minute recovery, no time limit and hidden launch', { skip: !windows }, async () => {
  const { stdout } = await powershell(`. ${literal(script)}; $task = New-FeedbackTaskDefinition; ` +
    `[ordered]@{ description=$task.RegistrationInfo.Description; execute=$task.Actions.Item(1).Path; arguments=$task.Actions.Item(1).Arguments; ` +
    `directory=$task.Actions.Item(1).WorkingDirectory; logonType=[int]$task.Principal.LogonType; runLevel=[int]$task.Principal.RunLevel; ` +
    `triggerCount=$task.Triggers.Count; logonUser=$task.Triggers.Item(1).UserId; interval=$task.Triggers.Item(2).Repetition.Interval; ` +
    `timeLimit=$task.Settings.ExecutionTimeLimit; multiple=[int]$task.Settings.MultipleInstances; ` +
    `hidden=$task.Settings.Hidden; batteryBlocked=$task.Settings.DisallowStartIfOnBatteries; ` +
    `batteryStop=$task.Settings.StopIfGoingOnBatteries; available=$task.Settings.StartWhenAvailable } | ConvertTo-Json -Compress`);
  const definition = JSON.parse(stdout.trim());
  assert.equal(definition.logonType, 3); // TASK_LOGON_INTERACTIVE_TOKEN
  assert.equal(definition.runLevel, 0); // TASK_RUNLEVEL_LUA
  assert.equal(definition.triggerCount, 2);
  assert.ok(definition.logonUser);
  assert.equal(definition.interval, 'PT1M');
  assert.equal(definition.timeLimit, 'PT0S');
  assert.equal(definition.multiple, 2); // TASK_INSTANCES_IGNORE_NEW
  assert.equal(definition.hidden, true);
  assert.equal(definition.batteryBlocked, false);
  assert.equal(definition.batteryStop, false);
  assert.equal(definition.available, true);
  assert.match(definition.arguments, /-WindowStyle Hidden/);
  assert.match(definition.arguments, /-Action run$/);
  assert.ok(path.isAbsolute(definition.execute));
  assert.equal(path.normalize(definition.directory), path.resolve(path.dirname(script), '../..'));
  assert.doesNotMatch(definition.arguments, /token|invite|server\.json/i);
});

test('native job returns the supervisor exit code and closes its surviving descendant', { skip: !windows }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cyber-bless-job-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pidFile = path.join(directory, 'grandchild.pid');
  const parentFile = path.join(directory, 'parent.mjs');
  await writeFile(parentFile, `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
process.exit(7);
`);
  const { stdout } = await powershell(`. ${literal(script)}; Initialize-FeedbackJob; ` +
    `$node = ${literal(process.execPath)}; $command = (Quote-WindowsArgument $node) + ' ' + (Quote-WindowsArgument ${literal(parentFile)}); ` +
    `$code = [CyberBless.FeedbackWindowsJob]::Run($node, $command, ${literal(directory)}); Write-Output "exit=$code"`);
  assert.match(stdout, /exit=7/);
  const descendant = Number(await readFile(pidFile, 'utf8'));
  assert.ok(Number.isInteger(descendant) && descendant > 0);
  // Job termination can finish asynchronously after CloseHandle; allow a short bounded wait.
  let alive = true;
  for (let attempt = 0; attempt < 30 && alive; attempt++) {
    try { process.kill(descendant, 0); await new Promise(resolve => setTimeout(resolve, 50)); }
    catch (error) { if (error.code !== 'ESRCH') throw error; alive = false; }
  }
  assert.equal(alive, false, 'surviving grandchild must be terminated when the job handle closes');
});

test('terminal log reader follows rotation even when the replacement is longer than the old file', { skip: !windows }, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cyber-bless-log-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = path.join(directory, 'supervisor.log');
  const { stdout } = await powershell(`. ${literal(script)}; $file = ${literal(log)}; ` +
    `[IO.File]::WriteAllText($file, "old` + '`n' + `"); $first = Read-FeedbackLogChunk -File $file; ` +
    `[IO.File]::Move($file, "$file.1"); [IO.File]::WriteAllText($file, "new public upload URL` + '`n' + `"); ` +
    `$next = Read-FeedbackLogChunk -File $file -Identity $first.Identity -Offset $first.Offset; ` +
    `@{ first=$first.Text; next=$next.Text; changed=($first.Identity -ne $next.Identity) } | ConvertTo-Json -Compress`);
  const result = JSON.parse(stdout.trim());
  assert.equal(result.first, 'old\n');
  assert.equal(result.next, 'new public upload URL\n');
  assert.equal(result.changed, true);
});
