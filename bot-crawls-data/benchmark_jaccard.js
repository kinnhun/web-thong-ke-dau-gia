const data = Array.from({length: 50000}, (_, i) => ({
    wordSet: new Set(['quyền', 'sử', 'dụng', 'đất', 'tại', 'thửa', 'số', String(i)])
}));

console.time('loop');
let matches = 0;
for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
        const sizeA = data[i].wordSet.size;
        const sizeB = data[j].wordSet.size;
        const maxSim = Math.min(sizeA, sizeB) / Math.max(sizeA, sizeB);
        if (maxSim < 0.70) continue;
        
        let intersection = 0;
        for (const w of data[i].wordSet) {
            if (data[j].wordSet.has(w)) intersection++;
        }
        const sim = intersection / (sizeA + sizeB - intersection);
        if (sim >= 0.70) matches++;
    }
}
console.timeEnd('loop');
console.log('Matches:', matches);
