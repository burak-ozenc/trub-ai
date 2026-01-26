/**
 * Python Bridge - Execute Python scripts from Node.js
 *
 * Provides utilities to execute Python processing scripts
 * and parse their JSON output.
 */

import { spawn } from 'child_process';
import path from 'path';

export interface PythonExecutionOptions {
  pythonExecutable?: string;
  workingDirectory?: string;
  timeout?: number;
}

export interface PythonProcessResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface SongProcessingOutput {
  success: boolean;
  files: {
    beginner_midi: string;
    intermediate_midi: string;
    advanced_midi: string;
    beginner_sheet_music: string;
    intermediate_sheet_music: string;
    advanced_sheet_music: string;
    backing_track: string;
  };
  metadata: {
    tempo: number;
    key_signature: string;
    time_signature: string;
    duration_seconds: number;
    total_notes: number;
    pitch_range: [number, number];
  };
}

/**
 * Execute a Python script and capture its output
 */
export async function executePythonScript(
  scriptPath: string,
  args: string[],
  options: PythonExecutionOptions = {}
): Promise<PythonProcessResult> {
  const {
    pythonExecutable = 'python',
    workingDirectory = process.cwd(),
    timeout = 300000, // 5 minutes default
  } = options;

  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(pythonExecutable, [scriptPath, ...args], {
      cwd: workingDirectory,
    });

    let stdout = '';
    let stderr = '';
    let timeoutHandle: NodeJS.Timeout;

    // Set timeout
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error(`Python script execution timed out after ${timeout}ms`));
      }, timeout);
    }

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (exitCode) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      resolve({
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
      });
    });

    pythonProcess.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      reject(error);
    });
  });
}

/**
 * Parse JSON output from Python script
 *
 * Extracts JSON from stdout, handles both pure JSON and JSON mixed with logs
 */
export function parseJsonOutput<T = any>(stdout: string): T {
  // First try to parse the entire stdout as JSON
  try {
    return JSON.parse(stdout.trim());
  } catch {
    // If that fails, try to extract JSON from mixed output
    // Look for JSON object (starts with { and ends with })
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error(`Failed to parse JSON output: ${e}`);
      }
    }
    throw new Error('No JSON found in Python script output');
  }
}

/**
 * Execute song processing Python script
 */
export async function executeSongProcessing(
  songTitle: string,
  jsonOutputMode: boolean = true,
  options: PythonExecutionOptions = {}
): Promise<SongProcessingOutput> {
  // Path to Python script (relative to backend root)
  const scriptPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'audio-service',
    'scripts',
    'process_songs.py'
  );

  // Working directory should be audio-service for proper relative paths
  const audioServiceDir = path.join(__dirname, '..', '..', '..', '..', 'audio-service');

  const args = ['--song', songTitle];
  if (jsonOutputMode) {
    args.push('--json-output');
  }

  const result = await executePythonScript(scriptPath, args, {
    ...options,
    workingDirectory: audioServiceDir,
  });

  if (!result.success) {
    throw new Error(`Python script failed: ${result.stderr || 'Unknown error'}`);
  }

  // Parse JSON output
  try {
    const output = parseJsonOutput<SongProcessingOutput>(result.stdout);

    if (!output.success) {
      throw new Error('Processing failed according to Python script');
    }

    return output;
  } catch (error) {
    throw new Error(`Failed to parse Python output: ${error}\n\nStdout: ${result.stdout}\n\nStderr: ${result.stderr}`);
  }
}

/**
 * Validate Python environment
 */
export async function validatePythonEnvironment(
  pythonExecutable: string = 'python'
): Promise<{ valid: boolean; version: string; error?: string }> {
  return new Promise((resolve) => {
    // Use --version which is simpler and more reliable across platforms
    const pythonProcess = spawn(pythonExecutable, ['--version']);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (exitCode) => {
      if (exitCode === 0) {
        // Parse version from "Python 3.11.7" format
        const output = stdout || stderr; // Some Python versions output to stderr
        const match = output.match(/Python (\d+)\.(\d+)/);

        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          const version = `${major}.${minor}`;

          // Require Python 3.11+
          if (major === 3 && minor >= 11) {
            resolve({ valid: true, version });
          } else {
            resolve({
              valid: false,
              version,
              error: `Python 3.11+ required, found ${version}`,
            });
          }
        } else {
          resolve({
            valid: false,
            version: '',
            error: 'Could not parse Python version',
          });
        }
      } else {
        resolve({
          valid: false,
          version: '',
          error: stderr || 'Failed to execute Python',
        });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({
        valid: false,
        version: '',
        error: `Python not found: ${error.message}`,
      });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve({
        valid: false,
        version: '',
        error: 'Python validation timed out',
      });
    }, 5000);
  });
}
