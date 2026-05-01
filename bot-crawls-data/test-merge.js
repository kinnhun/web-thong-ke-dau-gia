function mergeDuplicateGroups(...groupSets) {
  const adjacency = new Map();

  const ensureNode = (id) => {
    if (!adjacency.has(id)) {
      adjacency.set(id, new Set());
    }
  };

  for (const groups of groupSets) {
    for (const group of groups) {
      if (!Array.isArray(group) || group.length < 2) continue;

      for (let i = 0; i < group.length; i++) {
        ensureNode(group[i]);
        if (i > 0) {
          adjacency.get(group[i]).add(group[i - 1]);
          adjacency.get(group[i - 1]).add(group[i]);
        }
      }
    }
  }

  const visited = new Set();
  const mergedGroups = [];

  for (const [node, _] of adjacency.entries()) {
    if (visited.has(node)) continue;

    const group = [];
    const queue = [node];
    visited.add(node);

    while (queue.length > 0) {
      const current = queue.shift();
      group.push(current);

      for (const neighbor of adjacency.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (group.length >= 2) {
      mergedGroups.push(group.sort((a, b) => a - b));
    }
  }

  return mergedGroups;
}

const g1 = [[1, 2], [3, 4]];
const g2 = [[1, 2, 3, 4]];
console.log(mergeDuplicateGroups(g1, g2));
