import { readFile } from 'node:fs/promises';
import { Client, type ClientChannel, type ConnectConfig, type ExecOptions, type SFTPWrapper } from 'ssh2';

export type ConnectOptions = ConnectConfig & {
  /**
   * Path to a private key file. Read when connecting, if `privateKey` is not set.
   */
  identity?: string;
  /**
   * How many times to try connecting before giving up. Default: 10
   */
  reconnectTries?: number;
  /**
   * Delay between connection attempts, in milliseconds. Default: 5000
   */
  reconnectDelay?: number;
};

/**
 * Quote one argument for a POSIX shell, leaving plainly safe ones alone.
 */
export function shellQuote(arg: string): string {
  if (/^[\w@%+=:,./-]+$/.test(arg)) return arg;
  return `'${arg.replaceAll("'", `'"'"'`)}'`;
}

export function shellCommand(cmd: string, args: string[] = []): string {
  return [cmd, ...args].map(shellQuote).join(' ');
}

export class CommandError extends Error {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(command: string, code: number | null, stdout: string, stderr: string) {
    super(`\`${command}\` exited with ${code}${stderr ? `: ${stderr.trim()}` : ''}`);
    this.name = 'CommandError';
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * Promise wrappers for the SFTP calls we use
 */
export type SFTP = {
  fastPut(localPath: string, remotePath: string): Promise<void>;
  fastGet(remotePath: string, localPath: string): Promise<void>;
  writeFile(remotePath: string, data: string | Buffer): Promise<void>;
};

/**
 * A small promise based wrapper around an `ssh2` client.
 *
 * Every call (re)connects if needed, so a dropped connection is picked up again on the next use.
 */
export class SSH {
  readonly config: ConnectOptions;

  #connection?: Promise<Client>;
  #sftp?: Promise<SFTPWrapper>;

  constructor(config: ConnectOptions) {
    this.config = config;
  }

  /**
   * Connect, or return the existing connection
   */
  connect(): Promise<Client> {
    this.#connection ??= this.#connectWithRetries().catch(e => {
      this.#connection = undefined;
      throw e;
    });
    return this.#connection;
  }

  async #connectWithRetries(): Promise<Client> {
    const { identity, reconnectTries = 10, reconnectDelay = 5000, ...config } = this.config;

    if (identity && !config.privateKey) config.privateKey = await readFile(identity);

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.#connectOnce(config);
      } catch (e) {
        if (attempt >= reconnectTries) throw e;
        await new Promise(resolve => setTimeout(resolve, reconnectDelay));
      }
    }
  }

  #connectOnce(config: ConnectConfig): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const forget = () => {
        // Only forget the connection we made, not a newer one
        this.#connection?.then(c => {
          if (c !== client) return;
          this.#connection = undefined;
          this.#sftp = undefined;
        });
      };

      client
        .once('ready', () => {
          client.removeListener('error', reject);
          client.on('error', forget);
          resolve(client);
        })
        .once('error', reject)
        .once('close', forget)
        .connect(config);
    });
  }

  /**
   * Start a command and return its channel, to stream its output
   */
  async spawn(cmd: string, args: string[] = [], options: ExecOptions = {}): Promise<ClientChannel> {
    const client = await this.connect();
    return new Promise((resolve, reject) =>
      client.exec(shellCommand(cmd, args), options, (err, channel) => (err ? reject(err) : resolve(channel))),
    );
  }

  /**
   * Run a command to completion.
   *
   * @returns The command's stdout
   * @throws CommandError if it exits with a non-zero code
   */
  async exec(cmd: string, args: string[] = [], options: ExecOptions = {}): Promise<string> {
    const channel = await this.spawn(cmd, args, options);
    const command = shellCommand(cmd, args);

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let code: number | null = null;

      channel.on('data', (data: Buffer) => (stdout += data.toString()));
      channel.stderr.on('data', (data: Buffer) => (stderr += data.toString()));
      channel.on('exit', (exitCode: number | null) => (code = exitCode));
      channel.on('close', () =>
        code === 0 ? resolve(stdout) : reject(new CommandError(command, code, stdout, stderr)),
      );
    });
  }

  #rawSftp(): Promise<SFTPWrapper> {
    this.#sftp ??= this.connect()
      .then(
        client => new Promise<SFTPWrapper>((resolve, reject) => client.sftp((e, s) => (e ? reject(e) : resolve(s)))),
      )
      .catch(e => {
        this.#sftp = undefined;
        throw e;
      });
    return this.#sftp;
  }

  sftp(): SFTP {
    const call =
      <A extends unknown[]>(fn: (sftp: SFTPWrapper, ...args: [...A, (err?: Error | null) => void]) => void) =>
      async (...args: A): Promise<void> => {
        const sftp = await this.#rawSftp();
        await new Promise<void>((resolve, reject) => fn(sftp, ...args, err => (err ? reject(err) : resolve())));
      };

    return {
      fastPut: call<[string, string]>((s, local, remote, cb) => s.fastPut(local, remote, cb)),
      fastGet: call<[string, string]>((s, remote, local, cb) => s.fastGet(remote, local, cb)),
      writeFile: call<[string, string | Buffer]>((s, remote, data, cb) => s.writeFile(remote, data, cb)),
    };
  }

  /**
   * Close the connection, if any
   */
  async close(): Promise<void> {
    const connection = this.#connection;
    this.#connection = undefined;
    this.#sftp = undefined;
    if (!connection) return;
    try {
      (await connection).end();
    } catch {
      // Never connected
    }
  }
}
