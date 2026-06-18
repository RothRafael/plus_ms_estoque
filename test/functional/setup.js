const { execSync, spawnSync } = require('child_process');

const CONTAINER_NAME = 'plus-ms-estoque-func-test';
const IMAGE_NAME = 'plus-ms-estoque-func-test';
const HOST_PORT = 3001;
const CONTAINER_PORT = 3000;

async function waitForApp(url, retries = 30, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`App at ${url} did not become ready after ${retries} retries`);
}

module.exports = async function setup() {
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'inherit' });
  execSync(`docker build -t ${IMAGE_NAME} .`, { stdio: 'inherit' });
  execSync(
    `docker run -d --name ${CONTAINER_NAME} -p ${HOST_PORT}:${CONTAINER_PORT} ${IMAGE_NAME}`,
    { stdio: 'inherit' }
  );
  await waitForApp(`http://localhost:${HOST_PORT}/health`);
  process.env.FUNC_TEST_BASE_URL = `http://localhost:${HOST_PORT}`;
};
