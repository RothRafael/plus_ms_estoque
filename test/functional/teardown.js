const { spawnSync } = require('child_process');

const CONTAINER_NAME = 'plus-ms-estoque-func-test';

module.exports = async function teardown() {
  spawnSync('docker', ['rm', '-f', CONTAINER_NAME], { stdio: 'inherit' });
};
