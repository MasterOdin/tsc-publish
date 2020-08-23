import { EventEmitter } from 'events';

const childProcess: Record<string, unknown> = jest.createMockFromModule('child_process');

class SpawnedProcess extends EventEmitter {
  public constructor() {
    super();

    setTimeout(() => {
      this.emit('exit', 0);
    }, 500);
  }
}

childProcess.spawn = jest.fn((): SpawnedProcess => {
  return new SpawnedProcess();
});

export = childProcess;
