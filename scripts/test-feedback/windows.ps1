param(
    [ValidateSet('install', 'run', 'start', 'stop', 'status', 'uninstall', 'logs')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$script:WorkspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$script:FeedbackScript = Join-Path $PSScriptRoot 'windows.ps1'
$script:TaskName = 'CyberBless-TestFeedback'
$script:TaskDescription = "CyberBless feedback supervisor | $script:WorkspaceRoot"
$script:RuntimeDirectory = Join-Path $script:WorkspaceRoot 'artifacts/test-feedback'

function Quote-WindowsArgument([string]$Value) {
    # CommandLineToArgvW escaping, including trailing slashes before the closing quote.
    return '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}

function Get-FeedbackNode {
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    if (-not [IO.Path]::IsPathRooted($node) -or -not (Test-Path -LiteralPath $node -PathType Leaf)) {
        throw 'An installed Node.js executable is required.'
    }
    return $node
}

function Get-FeedbackScheduler {
    # COM also works when the optional ScheduledTasks CIM provider is unavailable.
    $scheduler = New-Object -ComObject 'Schedule.Service'
    $scheduler.Connect()
    return $scheduler
}

function Get-OwnedFeedbackTask {
    $folder = (Get-FeedbackScheduler).GetFolder('\')
    try { $task = $folder.GetTask($script:TaskName) }
    catch {
        $taskError = $_.Exception
        while ($null -ne $taskError) {
            if ($taskError.HResult -eq -2147024894) { return $null } # ERROR_FILE_NOT_FOUND
            $taskError = $taskError.InnerException
        }
        throw
    }
    if ($task.Definition.RegistrationInfo.Description -ne $script:TaskDescription) {
        throw "Task $script:TaskName belongs to another installation; it was left untouched."
    }
    return $task
}

function New-FeedbackTaskDefinition {
    $null = Get-FeedbackNode
    $powershell = Join-Path $PSHOME 'powershell.exe'
    if (-not (Test-Path -LiteralPath $powershell -PathType Leaf)) { throw 'Windows PowerShell is required.' }
    $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ' +
        (Quote-WindowsArgument $script:FeedbackScript) + ' -Action run'
    $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $task = (Get-FeedbackScheduler).NewTask(0)
    $task.RegistrationInfo.Description = $script:TaskDescription
    $task.RegistrationInfo.Author = $user
    $task.Principal.UserId = $user
    $task.Principal.LogonType = 3 # TASK_LOGON_INTERACTIVE_TOKEN, no stored password
    $task.Principal.RunLevel = 0 # TASK_RUNLEVEL_LUA, never request elevation
    $logon = $task.Triggers.Create(9) # TASK_TRIGGER_LOGON
    $logon.UserId = $user
    $logon.Enabled = $true
    $recovery = $task.Triggers.Create(1) # TASK_TRIGGER_TIME
    $recovery.StartBoundary = (Get-Date).AddMinutes(1).ToString('yyyy-MM-ddTHH:mm:ss')
    $recovery.Repetition.Interval = 'PT1M'
    $recovery.Repetition.StopAtDurationEnd = $false
    $recovery.Enabled = $true
    $task.Settings.MultipleInstances = 2 # TASK_INSTANCES_IGNORE_NEW
    $task.Settings.ExecutionTimeLimit = 'PT0S'
    $task.Settings.DisallowStartIfOnBatteries = $false
    $task.Settings.StopIfGoingOnBatteries = $false
    $task.Settings.StartWhenAvailable = $true
    $task.Settings.Hidden = $true
    $task.Settings.Enabled = $true
    $task.Settings.AllowDemandStart = $true
    $taskAction = $task.Actions.Create(0) # TASK_ACTION_EXEC
    $taskAction.Path = $powershell
    $taskAction.Arguments = $arguments
    $taskAction.WorkingDirectory = $script:WorkspaceRoot
    return $task
}

function Write-RunnerLog([string]$Message) {
    $null = New-Item -ItemType Directory -Path $script:RuntimeDirectory -Force
    $file = Join-Path $script:RuntimeDirectory 'runner.log'
    # Runner messages are short, capped at 1 MiB plus one previous file.
    if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -ge 1MB) {
        $previous = "$file.1"
        if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Force }
        Move-Item -LiteralPath $file -Destination $previous
    }
    Add-Content -LiteralPath $file -Encoding UTF8 -Value ("{0:o} {1}" -f (Get-Date), $Message)
}

function Initialize-FeedbackJob {
    if ('CyberBless.FeedbackWindowsJob' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace CyberBless {
    public static class FeedbackWindowsJob {
        [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
            public long ProcessTime, JobTime;
            public uint Flags;
            public UIntPtr MinWorkingSet, MaxWorkingSet;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass, SchedulingClass;
        }
        [StructLayout(LayoutKind.Sequential)] struct IoCounters {
            public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes;
        }
        [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
            public BasicLimits Basic;
            public IoCounters Io;
            public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
        }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
            public uint Size;
            public string Reserved, Desktop, Title;
            public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
            public ushort ShowWindow, ReservedBytes;
            public IntPtr ReservedData, StdInput, StdOutput, StdError;
        }
        [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {
            public IntPtr Process, Thread;
            public uint ProcessId, ThreadId;
        }
        [StructLayout(LayoutKind.Sequential)] struct FileInformation {
            public uint Attributes;
            public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
            public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool SetInformationJobObject(IntPtr job, int informationClass, ref ExtendedLimits limits, uint length);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool CreateProcess(string application, StringBuilder commandLine, IntPtr processAttributes,
            IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory,
            ref StartupInfo startup, out ProcessInfo process);
        [DllImport("kernel32.dll", SetLastError = true)] static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
        [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr process, uint code);
        [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GetFileInformationByHandle(IntPtr handle, out FileInformation information);

        public static string FileIdentity(IntPtr handle) {
            FileInformation information;
            if (!GetFileInformationByHandle(handle, out information)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return information.Volume.ToString("x8") + information.IndexHigh.ToString("x8") + information.IndexLow.ToString("x8");
        }

        public static int Run(string executable, string commandLine, string directory) {
            IntPtr job = IntPtr.Zero;
            ProcessInfo process = new ProcessInfo();
            bool resumed = false;
            try {
                job = CreateJobObject(IntPtr.Zero, null);
                if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
                ExtendedLimits limits = new ExtendedLimits();
                limits.Basic.Flags = 0x00002000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                StartupInfo startup = new StartupInfo();
                startup.Size = (uint)Marshal.SizeOf(startup);
                // Assign before resuming: no child can escape during the spawn/assign interval.
                if (!CreateProcess(executable, new StringBuilder(commandLine), IntPtr.Zero, IntPtr.Zero, false,
                    0x08000004, IntPtr.Zero, directory, ref startup, out process)) // NO_WINDOW | SUSPENDED
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!AssignProcessToJobObject(job, process.Process)) throw new Win32Exception(Marshal.GetLastWin32Error());
                if (ResumeThread(process.Thread) == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
                resumed = true;
                if (WaitForSingleObject(process.Process, uint.MaxValue) == uint.MaxValue)
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                uint exitCode;
                if (!GetExitCodeProcess(process.Process, out exitCode)) throw new Win32Exception(Marshal.GetLastWin32Error());
                return unchecked((int)exitCode);
            } finally {
                if (!resumed && process.Process != IntPtr.Zero) TerminateProcess(process.Process, 1);
                if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
                if (process.Process != IntPtr.Zero) CloseHandle(process.Process);
                // Also closes any surviving child/grandchild after the supervisor exits.
                if (job != IntPtr.Zero) CloseHandle(job);
            }
        }
    }
}
'@
}

function Invoke-FeedbackRunner {
    $node = Get-FeedbackNode
    $supervisor = Join-Path $PSScriptRoot 'supervisor.mjs'
    if (-not (Test-Path -LiteralPath $supervisor -PathType Leaf)) { throw 'Feedback supervisor script is missing.' }
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $identity = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($script:WorkspaceRoot.ToLowerInvariant())))).Replace('-', '').Substring(0, 24) }
    finally { $hash.Dispose() }
    $mutex = New-Object Threading.Mutex($false, "Local\CyberBless-TestFeedback-$identity")
    $owned = $false
    try {
        try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
        if (-not $owned) { return }
        Initialize-FeedbackJob
        $delay = 2
        while ($true) {
            $started = Get-Date
            try {
                $commandLine = (Quote-WindowsArgument $node) + ' ' + (Quote-WindowsArgument $supervisor)
                $code = [CyberBless.FeedbackWindowsJob]::Run($node, $commandLine, $script:WorkspaceRoot)
                Write-RunnerLog "Supervisor exited ($code); restarting."
            } catch {
                # Do not include child arguments/configuration or exception data in this log.
                Write-RunnerLog ('Supervisor could not run ({0}); retrying.' -f $_.Exception.GetType().Name)
            }
            if (((Get-Date) - $started).TotalSeconds -ge 60) { $delay = 2 }
            Start-Sleep -Seconds $delay
            $delay = [Math]::Min(60, $delay * 2)
        }
    } finally {
        if ($owned) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

function Show-FeedbackStatus {
    $task = Get-OwnedFeedbackTask
    if ($null -eq $task) { Write-Output 'Feedback auto-start: not installed'; return }
    $states = @('Unknown', 'Disabled', 'Queued', 'Ready', 'Running')
    Write-Output ("Feedback auto-start: {0}" -f $states[[int]$task.State])
    Write-Output 'Local inbox: http://127.0.0.1:4319/'
    $file = Join-Path $script:RuntimeDirectory 'supervisor-runtime.json'
    if (Test-Path -LiteralPath $file) {
        try {
            $runtime = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($runtime.schemaVersion -eq 1 -and $task.State -eq 4) {
                Write-Output ("Receiver: {0}; tunnel: {1}" -f $runtime.receiver, $runtime.tunnel)
                if ($runtime.status -eq 'running' -and $runtime.publicUrl -match '^https://[a-z0-9-]+\.trycloudflare\.com/?$') {
                    Write-Output ("Public upload URL: {0}" -f $runtime.publicUrl)
                }
            }
        } catch { Write-Output 'Runtime status is not available yet.' }
    }
}

function Read-FeedbackLogChunk([string]$File, [string]$Identity = '', [long]$Offset = 0, [bool]$Initial = $false) {
    Initialize-FeedbackJob
    $stream = $null
    $reader = $null
    try {
        # Release between polls and permit rename/delete, so rotation cannot block the writer.
        $stream = [IO.FileStream]::new($File, [IO.FileMode]::Open, [IO.FileAccess]::Read,
            ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
        $currentIdentity = [CyberBless.FeedbackWindowsJob]::FileIdentity($stream.SafeFileHandle.DangerousGetHandle())
        if ($Identity -ne $currentIdentity -or $Offset -gt $stream.Length) { $Offset = 0 }
        $null = $stream.Seek($Offset, [IO.SeekOrigin]::Begin)
        $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $true, 4096, $true)
        $text = $reader.ReadToEnd()
        if ($Initial) { $text = (($text -split "`n" | Select-Object -Last 31) -join "`n") }
        return [PSCustomObject]@{ Identity = $currentIdentity; Offset = $stream.Position; Text = $text }
    } finally {
        if ($null -ne $reader) { $reader.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Invoke-FeedbackWindowsAction {
    switch ($Action) {
        'install' {
            $existing = Get-OwnedFeedbackTask
            $definition = New-FeedbackTaskDefinition
            if ($null -ne $existing) { $existing.Enabled = $false; $existing.Stop(0) }
            $folder = (Get-FeedbackScheduler).GetFolder('\')
            $task = $folder.RegisterTaskDefinition($script:TaskName, $definition, 6, $definition.Principal.UserId, $null, 3, $null)
            $null = $task.Run($null)
            Write-Output 'Installed login auto-start and minute recovery; feedback service is starting.'
        }
        'run' { Invoke-FeedbackRunner }
        'start' {
            $task = Get-OwnedFeedbackTask
            if ($null -eq $task) { throw 'Run -Action install first.' }
            $task.Enabled = $true
            $null = $task.Run($null)
            Write-Output 'Feedback auto-start enabled; service is starting.'
        }
        'stop' {
            $task = Get-OwnedFeedbackTask
            if ($null -ne $task) {
                # Disable first so the periodic recovery trigger cannot undo an intentional stop.
                $task.Enabled = $false
                $task.Stop(0)
            }
            Write-Output 'Feedback service stopped; auto-start disabled until start/install.'
        }
        'uninstall' {
            $task = Get-OwnedFeedbackTask
            if ($null -ne $task) {
                $task.Enabled = $false
                $task.Stop(0)
                (Get-FeedbackScheduler).GetFolder('\').DeleteTask($script:TaskName, 0)
            }
            Write-Output 'Feedback auto-start removed. Feedback files and invitation were preserved.'
        }
        'logs' {
            $file = Join-Path $script:RuntimeDirectory 'supervisor.log'
            $null = New-Item -ItemType Directory -Path $script:RuntimeDirectory -Force
            if (-not (Test-Path -LiteralPath $file)) { $null = New-Item -ItemType File -Path $file }
            Write-Output 'Watching feedback service log; Ctrl+C only closes this viewer.'
            $identity = ''
            [long]$offset = 0
            $initial = $true
            while ($true) {
                try {
                    $chunk = Read-FeedbackLogChunk -File $file -Identity $identity -Offset $offset -Initial $initial
                    if ($chunk.Text) { [Console]::Write($chunk.Text) }
                    $identity = $chunk.Identity; $offset = $chunk.Offset; $initial = $false
                } catch [IO.IOException] { <# Rotation may briefly leave no current file; retry. #> }
                Start-Sleep -Milliseconds 500
            }
        }
        'status' { Show-FeedbackStatus }
    }
}

# Dot-sourcing exposes helpers for parser/task-definition tests without installing anything.
if ($MyInvocation.InvocationName -ne '.') {
    try { Invoke-FeedbackWindowsAction }
    catch { Write-Error $_.Exception.Message; exit 1 }
}
