const data = Array.from({length: 50000}, (_, i) => ({
    index: i,
    wordSet: new Set(['quyền', 'sử', 'dụng', 'đất', 'tại', 'thửa', 'số', String(i)])
}));

// ADD SOME VARIANCE TO SIZES SO IT'S REALISTIC
for (let i = 0; i < 20000; i++) data[i].wordSet.add('phường');
for (let i = 0; i < 10000; i++) data[i].wordSet.add('quận');

console.time('loop_optimized');
data.sort((a, b) => a.wordSet.size - b.wordSet.size);

let matches = 0;
for (let i = 0; i < data.length; i++) {
    const sizeA = data[i].wordSet.size;
    const maxSizeB = sizeA / 0.70;
    
    for (let j = i + 1; j < data.length; j++) {
        const sizeB = data[j].wordSet.size;
        if (sizeB > maxSizeB) break;
        
        let intersection = 0;
        for (const w of data[i].wordSet) {
            if (data[j].wordSet.has(w)) intersection++;
        }
        const sim = intersection / (sizeA + sizeB - intersection);
        if (sim >= 0.70) matches++;
    }
}
console.timeEnd('loop_optimized');
console.log('Matches:', matches);
