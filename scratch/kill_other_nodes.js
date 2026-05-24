const { execSync } = require('child_process');

function killOtherNodes() {
  const myPid = process.pid;
  console.log(`Current process PID: ${myPid}`);

  // Find parent PID on Windows
  let parentPid = null;
  try {
    const wmicOut = execSync(`wmic process where processid=${myPid} get parentprocessid`).toString();
    const matches = wmicOut.match(/\d+/g);
    if (matches && matches.length > 0) {
      parentPid = parseInt(matches[0]);
      console.log(`Parent process PID: ${parentPid}`);
    }
  } catch (e) {
    console.error('Failed to get parent PID:', e.message);
  }

  // Get tasklist info for node.exe
  let tasklistOut = '';
  try {
    tasklistOut = execSync('tasklist /fi "imagename eq node.exe" /fo csv /nh').toString();
  } catch (e) {
    console.error('Failed to run tasklist:', e.message);
    return;
  }

  const lines = tasklistOut.split('\n').filter(l => l.trim().length > 0);
  console.log(`Found ${lines.length} node processes.`);

  let killedCount = 0;
  for (const line of lines) {
    // CSV format: "node.exe","PID","Session Name","Session#","Mem Usage"
    const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
    if (parts.length >= 2) {
      const pid = parseInt(parts[1]);
      if (isNaN(pid)) continue;

      if (pid === myPid || pid === parentPid) {
        console.log(`Keeping active process PID: ${pid}`);
        continue;
      }

      // Check if this pid is grandparent PID (just in case)
      let isAncestor = false;
      try {
        let currentParent = parentPid;
        for (let i = 0; i < 5; i++) {
          if (!currentParent) break;
          if (pid === currentParent) {
            isAncestor = true;
            break;
          }
          const pOut = execSync(`wmic process where processid=${currentParent} get parentprocessid`).toString();
          const pMatches = pOut.match(/\d+/g);
          currentParent = pMatches && pMatches.length > 0 ? parseInt(pMatches[0]) : null;
        }
      } catch (e) {}

      if (isAncestor) {
        console.log(`Keeping ancestor process PID: ${pid}`);
        continue;
      }

      console.log(`Killing orphaned node process PID: ${pid}...`);
      try {
        execSync(`taskkill /f /pid ${pid}`);
        killedCount++;
      } catch (err) {
        console.error(`Failed to kill PID ${pid}:`, err.message);
      }
    }
  }

  console.log(`Successfully terminated ${killedCount} orphaned node processes.`);
}

killOtherNodes();
