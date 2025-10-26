/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

export function init(): Profiler {
  const defaults: ProfilerMemory = {
    data: {},
    total: 0
  };

  if (!Memory.profiler) {
    Memory.profiler = defaults;
  }

  const cli: Profiler = {
    clear() {
      const running = isEnabled();
      Memory.profiler = defaults;
      if (running) {
        Memory.profiler.start = Game.time;
      }
      return "Profiler Memory cleared";
    },

    output() {
      outputProfilerData();
      return "Done";
    },

    start() {
      Memory.profiler.start = Game.time;
      return "Profiler started";
    },

    status() {
      if (isEnabled()) {
        return "Profiler is running";
      }
      return "Profiler is stopped";
    },

    stop() {
      if (!isEnabled()) {
        return "Profiler is not running";
      }
      const timeRunning = Game.time - Memory.profiler.start!;
      Memory.profiler.total += timeRunning;
      delete Memory.profiler.start;
      return "Profiler stopped";
    },

    toString() {
      return (
        "Profiler.start() - Starts the profiler\n" +
        "Profiler.stop() - Stops/Pauses the profiler\n" +
        "Profiler.status() - Returns whether is profiler is currently running or not\n" +
        "Profiler.output() - Pretty-prints the collected profiler data to the console\n" +
        this.status()
      );
    }
  };

  return cli;
}

function wrapFunction(obj: object, key: PropertyKey, className?: string): void {
  const descriptor = Reflect.getOwnPropertyDescriptor(obj, key);
  if (!descriptor || descriptor.get || descriptor.set) {
    return;
  }

  if (key === "constructor") {
    return;
  }

  const originalFunction = descriptor.value;
  if (!originalFunction || typeof originalFunction !== "function") {
    return;
  }

  // set a key for the object in memory
  if (!className) {
    className = obj.constructor ? `${obj.constructor.name}` : "";
  }
  const memKey = className + `:${String(key)}`;

  // set a tag so we don't wrap a function twice
  const savedName = `__${String(key)}__`;
  if (Reflect.has(obj, savedName)) {
    return;
  }

  Reflect.set(obj, savedName, originalFunction);

  ///////////

  Reflect.set(obj, key, function (this: any, ...args: any[]) {
    if (isEnabled()) {
      const start = Game.cpu.getUsed();
      const result = originalFunction.apply(this, args);
      const end = Game.cpu.getUsed();
      record(memKey, end - start);
      return result;
    }
    return originalFunction.apply(this, args);
  });
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function profile(target: Function): void;
export function profile(
  target: object,
  key: string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  _descriptor: TypedPropertyDescriptor<Function>
): void;
export function profile(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  target: object | Function,
  key?: string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  _descriptor?: TypedPropertyDescriptor<Function>
): void {
  if (!__PROFILER_ENABLED__) {
    return;
  }

  if (key) {
    // case of method decorator
    wrapFunction(target, key);
    return;
  }

  // case of class decorator

  const ctor = target as any;
  if (!ctor.prototype) {
    return;
  }

  const className = ctor.name;
  Reflect.ownKeys(ctor.prototype).forEach(k => {
    wrapFunction(ctor.prototype, k, className);
  });
}

function isEnabled(): boolean {
  return Memory.profiler.start !== undefined;
}

function record(key: string | symbol, time: number): void {
  if (!Memory.profiler.data[String(key)]) {
    Memory.profiler.data[String(key)] = {
      calls: 0,
      time: 0
    };
  }
  Memory.profiler.data[String(key)].calls++;
  Memory.profiler.data[String(key)].time += time;
}

interface OutputData {
  name: string;
  calls: number;
  cpuPerCall: number;
  callsPerTick: number;
  cpuPerTick: number;
}

function outputProfilerData(): void {
  let totalTicks = Memory.profiler.total;
  if (Memory.profiler.start) {
    totalTicks += Game.time - Memory.profiler.start;
  }

  ///////
  // Process data
  let totalCpu = 0; // running count of average total CPU use per tick
  let calls: number;
  let time: number;
  let result: Partial<OutputData>;
  const data = Reflect.ownKeys(Memory.profiler.data).map(key => {
    calls = Memory.profiler.data[String(key)].calls;
    time = Memory.profiler.data[String(key)].time;
    result = {};
    result.name = String(key);
    result.calls = calls;
    result.cpuPerCall = time / calls;
    result.callsPerTick = calls / totalTicks;
    result.cpuPerTick = time / totalTicks;
    totalCpu += result.cpuPerTick;
    return result as OutputData;
  });

  data.sort((lhs, rhs) => rhs.cpuPerTick - lhs.cpuPerTick);

  ///////
  // Format data
  let output = "";

  // get function name max length
  const longestName = Math.max(...data.map(d => d.name.length)) + 2;

  //// Header line
  output += padRight("Function", longestName);
  output += padLeft("Tot Calls", 12);
  output += padLeft("CPU/Call", 12);
  output += padLeft("Calls/Tick", 12);
  output += padLeft("CPU/Tick", 12);
  output += padLeft("% of Tot\n", 12);

  ////  Data lines
  data.forEach(d => {
    output += padRight(`${d.name}`, longestName);
    output += padLeft(`${d.calls}`, 12);
    output += padLeft(`${d.cpuPerCall.toFixed(2)}ms`, 12);
    output += padLeft(`${d.callsPerTick.toFixed(2)}`, 12);
    output += padLeft(`${d.cpuPerTick.toFixed(2)}ms`, 12);
    output += padLeft(`${((d.cpuPerTick / totalCpu) * 100).toFixed(0)} %\n`, 12);
  });

  //// Footer line
  output += `${totalTicks} total ticks measured`;
  output += `\t\t\t${totalCpu.toFixed(2)} average CPU profiled per tick`;
  console.log(output);
}

// Helper functions for padding (replacing lodash)
function padLeft(str: string, length: number): string {
  return str.padStart(length, " ");
}

function padRight(str: string, length: number): string {
  return str.padEnd(length, " ");
}
