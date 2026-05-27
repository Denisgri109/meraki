const simulateUpload = (fileName) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Uploaded ${fileName}`);
    }, 500); // simulate 500ms upload time
  });
};

const runSequential = async (files) => {
  const start = Date.now();
  for (const file of files) {
    await simulateUpload(file);
  }
  const end = Date.now();
  return end - start;
};

const runParallel = async (files) => {
  const start = Date.now();
  await Promise.all(files.map(file => simulateUpload(file)));
  const end = Date.now();
  return end - start;
};

const run = async () => {
  const files = ['file1', 'file2', 'file3']; // max 3 photos according to selectionLimit

  console.log('Running Sequential Baseline...');
  const seqTime = await runSequential(files);
  console.log(`Sequential time: ${seqTime}ms`);

  console.log('\nRunning Parallel Optimized...');
  const parTime = await runParallel(files);
  console.log(`Parallel time: ${parTime}ms`);

  console.log(`\nImprovement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}% faster`);
};

run();
