import type { TaskGenerator } from "./types";

export function* waitTicks(ticks: number): TaskGenerator<void> {
  for (let i = 0; i < ticks; i++) {
    yield;
  }
}

export function* waitUntil(condition: () => boolean, maxTicks: number = Infinity): TaskGenerator<boolean> {
  let ticksWaited = 0;
  while (!condition() && ticksWaited < maxTicks) {
    yield;
    ticksWaited++;
  }
  return condition();
}

export function* sequence<T>(...generators: Array<() => TaskGenerator<T>>): TaskGenerator<T[]> {
  const results: T[] = [];
  for (const genFn of generators) {
    const gen = genFn();
    let result = gen.next();
    while (!result.done) {
      yield;
      result = gen.next();
    }
    results.push(result.value);
  }
  return results;
}

export function* retry<T>(
  generatorFn: () => TaskGenerator<T>,
  maxRetries: number = 3,
  delayTicks: number = 1
): TaskGenerator<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const gen = generatorFn();
      let result = gen.next();
      while (!result.done) {
        yield;
        result = gen.next();
      }
      return result.value;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        yield* waitTicks(delayTicks);
      }
    }
  }

  throw lastError;
}

export function* timeout<T>(generatorFn: () => TaskGenerator<T>, timeoutTicks: number): TaskGenerator<T> {
  const gen = generatorFn();
  let ticksElapsed = 0;
  let result = gen.next();

  while (!result.done && ticksElapsed < timeoutTicks) {
    yield;
    ticksElapsed++;
    result = gen.next();
  }

  if (result.done) {
    return result.value;
  }

  throw new Error(`Task timed out after ${timeoutTicks} ticks`);
}

export function* repeat<T>(generatorFn: () => TaskGenerator<T>, times: number): TaskGenerator<T[]> {
  const results: T[] = [];
  for (let i = 0; i < times; i++) {
    const gen = generatorFn();
    let result = gen.next();
    while (!result.done) {
      yield;
      result = gen.next();
    }
    results.push(result.value);
  }
  return results;
}

export function* whilst<T>(condition: () => boolean, generatorFn: () => TaskGenerator<T>): TaskGenerator<T[]> {
  const results: T[] = [];
  while (condition()) {
    const gen = generatorFn();
    let result = gen.next();
    while (!result.done) {
      yield;
      result = gen.next();
    }
    results.push(result.value);
  }
  return results;
}

export function* interval<T>(
  generatorFn: () => TaskGenerator<T>,
  intervalTicks: number,
  iterations: number = Infinity
): TaskGenerator<T[]> {
  const results: T[] = [];
  let count = 0;

  while (count < iterations) {
    const gen = generatorFn();
    let result = gen.next();
    while (!result.done) {
      yield;
      result = gen.next();
    }
    results.push(result.value);
    count++;

    if (count < iterations) {
      for (let i = 0; i < intervalTicks; i++) {
        yield;
      }
    }
  }

  return results;
}

export function* map<TItem, TResult>(
  items: TItem[],
  generatorFn: (item: TItem, index: number) => TaskGenerator<TResult>
): TaskGenerator<TResult[]> {
  const results: TResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item !== undefined) {
      const gen = generatorFn(item, i);
      let result = gen.next();
      while (!result.done) {
        yield;
        result = gen.next();
      }
      results.push(result.value as TResult);
    }
  }
  return results;
}

export function* filter<T>(
  items: T[],
  predicateFn: (item: T, index: number) => TaskGenerator<boolean>
): TaskGenerator<T[]> {
  const results: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item !== undefined) {
      const gen = predicateFn(item, i);
      let result = gen.next();
      while (!result.done) {
        yield;
        result = gen.next();
      }
      if (result.value) {
        results.push(item);
      }
    }
  }
  return results;
}

export function* race<T>(...generators: Array<() => TaskGenerator<T>>): TaskGenerator<T> {
  const gens = generators.map(fn => fn());
  const states = gens.map(() => ({ done: false, value: undefined as T | undefined }));

  while (true) {
    for (let i = 0; i < gens.length; i++) {
      const state = states[i];
      const gen = gens[i];
      if (state && gen && !state.done) {
        const result = gen.next();
        if (result.done) {
          state.done = true;
          return result.value as T;
        }
      }
    }
    yield;
  }
}

export function* all<T>(...generators: Array<() => TaskGenerator<T>>): TaskGenerator<T[]> {
  const results: T[] = [];
  for (const genFn of generators) {
    const gen = genFn();
    let result = gen.next();
    while (!result.done) {
      yield;
      result = gen.next();
    }
    results.push(result.value as T);
  }
  return results;
}
