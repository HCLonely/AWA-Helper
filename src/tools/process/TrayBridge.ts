/** @file Internal line protocol used by the Windows tray launcher. */
import * as readline from 'readline';

const protocolPrefix = '@@AWA-TRAY\t';

interface TrayBridgeCommands {
  shutdown: () => void
  startHelper: () => void
  stopHelper: () => void
  startAchievement: () => void
  stopAchievement: () => void
}

type TrayCommand = keyof TrayBridgeCommands;

const parseTrayCommand = (line: string): TrayCommand | undefined => {
  const commands: Record<string, TrayCommand> = {
    shutdown: 'shutdown',
    'start-helper': 'startHelper',
    'stop-helper': 'stopHelper',
    'start-achievement': 'startAchievement',
    'stop-achievement': 'stopAchievement'
  };
  return commands[line.trim().toLowerCase()];
};

class TrayBridge {
  private readonly input: readline.Interface;
  private closed = false;

  constructor(private readonly commands: TrayBridgeCommands) {
    this.input = readline.createInterface({ input: process.stdin });
    this.input.on('line', (line) => {
      const command = parseTrayCommand(line);
      if (command) {
        this.commands[command]();
      }
    });
    this.input.on('close', () => {
      if (!this.closed) {
        this.commands.shutdown();
      }
    });
  }

  ready(url?: string): void {
    this.send(`READY\t${url || ''}`);
  }

  error(): void {
    this.send('ERROR');
  }

  status(states: ReadonlyArray<{ name: string, status: string }>): void {
    const fields = states.map(({ name, status }) => `${name}=${status}`);
    this.send(`STATUS\t${fields.join('\t')}`);
  }

  close(): void {
    this.closed = true;
    this.input.close();
  }

  private send(message: string): void {
    process.stdout.write(`${protocolPrefix}${message}\n`);
  }
}

export { parseTrayCommand, TrayBridge, type TrayBridgeCommands };
