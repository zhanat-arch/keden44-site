export function createImportQueue({ process, onProgress = () => {} }) {
  const pending = [];
  let running = false;
  let total = 0;
  let completed = 0;
  let failed = 0;
  let errors = [];
  let runPromise = null;

  const snapshot = (stage, current = '') => ({ stage, current, total, completed, failed, errors: [...errors], pending: pending.length });

  async function drain() {
    running = true;
    onProgress(snapshot('running'));
    while (pending.length) {
      const file = pending.shift();
      onProgress(snapshot('running', file.name || 'PDF'));
      try {
        if (await process(file) === false) {
          failed += 1;
          errors.push(file.name || 'PDF');
        }
      } catch {
        failed += 1;
        errors.push(file.name || 'PDF');
      }
      completed += 1;
      onProgress(snapshot('running'));
    }
    running = false;
    const result = snapshot('done');
    onProgress(result);
    runPromise = null;
    return result;
  }

  function add(files) {
    const added = Array.from(files || []);
    if (!added.length) return runPromise || Promise.resolve(snapshot(running ? 'running' : 'idle'));
    if (!running && completed === total) {
      total = 0;
      completed = 0;
      failed = 0;
      errors = [];
    }
    pending.push(...added);
    total += added.length;
    onProgress(snapshot(running ? 'running' : 'queued'));
    if (!runPromise) runPromise = drain();
    return runPromise;
  }

  return { add, getState: () => snapshot(running ? 'running' : completed === total && total ? 'done' : 'idle') };
}
