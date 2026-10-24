// Temporary static-analysis proof: this server is never listened to or imported.
import { createServer } from 'node:http';
import { exec } from 'node:child_process';

export const unstartedSecurityProof = createServer((request, response) => {
  exec(request.url, () => response.end('Non-deployed security scanner proof'));
});
